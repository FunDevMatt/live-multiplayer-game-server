let app = require('express')();
let server = require('http').Server(app);
let io = require('socket.io')(server);
var ss = require('socket.io-stream');
const uuidv1 = require('uuid/v1');
var cors = require('cors')
var bodyParser  = require('body-parser');



const port = process.env.PORT || 3500;
app.use(cors())
app.use(bodyParser.json());




var AccessToken = require('twilio').jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;
var ACCOUNT_SID = 'AC92768a023e12375f36b7df65835f7aa8';
var API_KEY_SID = 'SK432ad20c199404ec122432ebe856a64e';
var API_KEY_SECRET = 'PDYKdjESyvfNUIUVRus7P8RgiYWrb9Fz';

var accessToken = new AccessToken(
	ACCOUNT_SID,
	API_KEY_SID,
	API_KEY_SECRET
);


const accountSid = 'AC92768a023e12375f36b7df65835f7aa8';
const authToken = '6db5b2da3b864cb20192cec0bb7064e7';
const client = require('twilio')(accountSid, authToken);
const { connect, createLocalTracks } = require('twilio-video');

app.post("/create-room", async (req, res) => {
	let roomName = uuidv1();
	try {
		let room =  await client.video.rooms
            .create({
               enableTurn: true,
               type: 'peer-to-peer',
               uniqueName: roomName
             })
		res.send(room)
	} catch (e) {
		return e
	}
	
})


server.listen(port, () => {
	console.log(`Server is up on ${port}`);
});

let searchingPool = {};
let usersOnline = 0;
io.on('connection', (socket) => {
	usersOnline++;
	io.emit('users-online', usersOnline);
	// player starts looking for opponent
	socket.on('game-searching', (name) => {
		// check if there are any opponents waiting in the search pool
		let opponentAvailable = Object.entries(searchingPool).length > 0;

		// if there is a player waiting, match with that player
		if (opponentAvailable) {
			let opponentId = Object.keys(searchingPool)[0];
			let opponent = searchingPool[opponentId];

			// generate random namespace name for match
			const gameNamespace = uuidv1();

			socket.emit('opponent-found', {
				socketId: opponentId,
				name: opponent.name,
				nameSpace: '/' + gameNamespace
			});

			// remove the matched player out of the search pool
			delete searchingPool[opponentId];

			// let player who was waiting in pool know they have been matched
			socket.to(opponentId).emit('opponent-found', {
				socketId: socket.id,
				name: name,
				nameSpace: '/' + gameNamespace
			});

			// create a namespace for match
			const nameSpace = io.of(gameNamespace);

			let activeMatches = {};
			activeMatches[gameNamespace] = {};
			nameSpace.on('connection', (nspSocket) => {
				let getUsername = () => {
					return activeMatches[gameNamespace][nspSocket.id];
				};
				// Make sure both users have loaded correctly
				nspSocket.on('user-ready', (name) => {
					activeMatches[gameNamespace][nspSocket.id] = name;
					// make sure both users have loaded to next page
					if (Object.entries(activeMatches[gameNamespace]).length === 2) {
						let players = [];
						// send to client the users invloved in the match
						for (let player in activeMatches[gameNamespace]) {
							let playerObject = {
								name: activeMatches[gameNamespace][player],
								socketId: player
							};
							players.push(playerObject);
						}
						nameSpace.emit('match-info', players);
					}
				});

				nspSocket.on("new-room-info", (data) => {
					let token = accessToken;
					const videoGrant = new VideoGrant({
						room: data.data.uniqueName,
					  });
					token.addGrant(videoGrant)
					token.identity = "greg"
					console.log(token)
					data.token = token.toJwt();

					nameSpace.emit("room-info", data)
				})

				nspSocket.on('message-sent', (message) => {
					let username = getUsername();
					nameSpace.emit('message-received', {
						text: message,
						username
					});
				});

				

				// if user disconnects, wipe the namespace out of active matches and delete the namespace
				nspSocket.on('disconnect', () => {
					nameSpace.emit('user-left');
					peerConnections = {};
					delete activeMatches[gameNamespace];
					delete io.nsps['/' + gameNamespace];
				});

			});

			// if there are no players waiting in pool, place the player searching in the pool
		} else {
			searchingPool[socket.id] = {
				name: name
			};
		}
	});

	socket.on('disconnect', () => {
		usersOnline--;
		io.emit('users-online', usersOnline);
		delete searchingPool[socket.id];
	});
});
