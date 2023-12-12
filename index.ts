import { ServerWebSocket } from "bun";

let messages: any = [];
let users: string[] = [];

const server = Bun.serve({
  port: 3020,
  fetch(request, server) {
    const url = new URL(request.url);

    if (url.pathname === "/chat") {
      console.log("upgrade!");
      const username = "user_" + Math.random().toString(16).slice(12);
      const room = url.searchParams.get("room");

      if (!room) {
        return new Response("Room is required", { status: 400 });
      }

      const success = server.upgrade(request, {
        data: { username, room },
      });

      return success
        ? undefined
        : new Response("Upgrade failed", { status: 400 });
    }

    if (url.pathname === "/w2g") {
      console.log("upgrade!");

      const username = url.searchParams.get("username")
        ? url.searchParams.get("username")
        : "user_" + Math.random().toString(16).slice(12);
      const room = url.searchParams.get("room");

      if (!room) {
        return new Response("Room is required", { status: 400 });
      }

      const success = server.upgrade(request, {
        data: { username, room },
      });

      return success
        ? undefined
        : new Response("Upgrade failed", { status: 400 });
    }

    return new Response("Hello world!", { status: 200 });
  },
  websocket: {
    open(ws) {
      const { username, room } = ws.data as { username: string; room: string };

      ws.subscribe(room);

      ws.publish(
        room,
        JSON.stringify({ type: "USERS_JOINED", data: username })
      );

      const getRoom = messages.find((i: any) => i.room === room)
        ? messages.find((i: any) => i.room === room)
        : undefined;

      console.log({ getRoom });

      // ws.send(JSON.stringify({ type: "ALL_USERS", data: users }));
      ws.send(JSON.stringify({ type: "INITIAL_MESSAGE", data: getRoom }));
      console.log("New connection opened for", username + " in room " + room);
    },
    message(ws, data) {
      const { username, room } = ws.data as { username: string; room: string };

      const message = { status: data, username, room };
      const getRoom = messages.find((i: any) => i.room === room)
        ? messages.find((i: any) => i.room === room)
        : undefined;

      // if getRoom is undefined push message to messages, if not overwrite getRoom inside messages with message
      getRoom
        ? (messages[messages.indexOf(getRoom)] = message)
        : messages.push(message);

      // messages.push(message);

      ws.publish(room, JSON.stringify({ type: "MESSAGES_ADD", data: message }));
      console.log("New message received: ", message);
    },
    close(ws) {
      const { username, room } = ws.data as { username: string; room: string };

      messages = messages.filter((i: any) => i.username !== username);

      ws.publish(
        room,
        JSON.stringify({ type: "USERS_REMOVE", data: username })
      );
      console.log("Connection closed", username + " data: " + messages);
    },
  },
});

console.log(`Server is running on port ${server.port}`);
