import { ServerWebSocket } from "bun";

let messages: any = [];
let users: string[] = [];

type MessageType = {
  user: string;
  text: string;
};

type UserMessagesType = {
  host: string;
  user: string[];
  messages: MessageType[];
};

type RoomType = {
  [key: string]: UserMessagesType;
};

let roomData: RoomType = {};

const STATUS_400 = { status: 400 };
const STATUS_200 = { status: 200 };
const ROOM_REQUIRED = "Room is required";
const UPGRADE_FAILED = "Upgrade failed";
const HELLO_WORLD = "Hello world!";
const USERS_JOINED = "USERS_JOINED";
const INITIAL_MESSAGE = "INITIAL_MESSAGE";
const PLAY_PAUSE = "PLAY_PAUSE";
const SEEK = "SEEK";
const USERS_REMOVE = "USERS_REMOVE";

function generateUsername(existingUsername: string | null): string {
  return existingUsername
    ? existingUsername
    : "user_" + Math.random().toString(16).slice(12);
}

function upgradeServer(
  request: any,
  server: any,
  username: string,
  room: string
) {
  const success = server.upgrade(request, {
    data: { username, room },
  });

  return success ? undefined : new Response(UPGRADE_FAILED, STATUS_400);
}

function findRoom(roomId: any) {
  const getRoom = roomData[roomId];

  return getRoom
    ? getRoom
    : (roomData[roomId] = {
        host: "" as string,
        user: [] as any,
        messages: [] as any,
      });
}

const server = Bun.serve({
  port: 3020,
  fetch(request, server) {
    const url = new URL(request.url);

    if (url.pathname === "/chat" || url.pathname === "/w2g") {
      console.log("upgrade!");
      const username = generateUsername(url.searchParams.get("username"));
      const room = url.searchParams.get("room");

      if (!room) {
        return new Response(ROOM_REQUIRED, STATUS_400);
      }

      return upgradeServer(request, server, username, room);
    }

    return new Response(HELLO_WORLD, STATUS_200);
  },
  websocket: {
    open(webSocket) {
      const { username, room } = webSocket.data as {
        username: string;
        room: string;
      };

      console.log("Room: ", JSON.stringify(roomData));

      webSocket.subscribe(room);

      const roomMessage = findRoom(room);

      if (roomMessage.host === "") {
        roomMessage.host = username;
      }

      roomMessage.user.push(username);

      console.log(roomMessage);

      webSocket.publish(
        room,
        JSON.stringify({ type: USERS_JOINED, data: roomMessage, username })
      );
      webSocket.send(
        JSON.stringify({ type: "STORED_DATA", data: roomMessage })
      );
      console.log("New connection opened for", username + " in room " + room);
    },
    message(webSocket, data: any) {
      const { username, room } = webSocket.data as {
        username: string;
        room: string;
      };

      const getRoom = findRoom(room);

      const parsedData = JSON.parse(data);

      switch (parsedData.type) {
        case "MESSAGE_SENT":
          getRoom.messages.push({ user: username, text: parsedData.text });

          webSocket.publish(
            room,
            JSON.stringify({ type: "MESSAGE_RECEIVED", data: getRoom })
          );
          break;
        case "PLAYER":
          console.log("New player event received: ", data);
          webSocket.publish(
            room,
            JSON.stringify({ type: "PLAYER", data: parsedData.playing })
          );
          break;
        case "PLAYER_SEEK":
          console.log("New player seek event received: ", data);
          webSocket.publish(
            room,
            JSON.stringify({ type: "PLAYER_SEEK", data: parsedData.time })
          );
          break;
      }

      // const type = JSON.parse(messageData).type;

      // const message = { type: PLAY_PAUSE, status: messageData, username, room };
      // const seek = { type: SEEK, time: messageData, username, room };
      // const roomMessage = findRoom(room);

      // switch (type) {
      //   case SEEK:
      //     console.log("New message received: ", seek);

      //     webSocket.publish(room, JSON.stringify({ type: SEEK, data: seek }));
      //     break;
      //   case PLAY_PAUSE:
      //     console.log("New message received: ", message);

      //     roomMessage
      //       ? (messages[messages.indexOf(roomMessage)] = message)
      //       : messages.push(message);
      //     webSocket.publish(
      //       room,
      //       JSON.stringify({ type: PLAY_PAUSE, data: message })
      //     );
      //     break;
      // }
    },
    close(webSocket) {
      const { username, room: roomId }: any = webSocket.data as {
        username: string;
        room: string;
      };

      const getRoom = findRoom(roomId);

      getRoom.user = getRoom.user.filter((user: any) => user !== username);

      // set host to the second user in the room if the host leaves and if there is a second user
      if (getRoom.host === username && getRoom.user.length > 0) {
        getRoom.host = getRoom.user[0];
      }

      if (getRoom.user.length === 0) {
        delete roomData[roomId];
      }

      webSocket.unsubscribe(roomId);
      server.publish(
        roomId,
        JSON.stringify({ type: "USER_QUIT", data: getRoom, username })
      );

      console.log(
        "Connection closed",
        username + " data: " + JSON.stringify(getRoom)
      );
    },
  },
});

console.log(`Server is running on port ${server.port}`);
