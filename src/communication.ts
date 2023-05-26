/**
 * @module communication
 * @description handles websocket communication between client and server
 */

import { Server, Socket } from "socket.io";
import { v4 } from 'uuid';
import { Room } from "./room";

export enum MessageType {
    CHAT_MESSAGE = 'chat message',
    CHAT_CATCHUP = 'chat catchup',
    REQUEST_USERNAME = 'request username',
    SET_USERNAME = 'set username',
    USERNAME_ERROR = 'username error',
    USERNAME_SUCCESS = 'username success',
    ONLINE_USERS = 'online users',
    LIST_ROOMS = 'list rooms',
    CREATE_ROOM = 'create room',
    CREATE_PRIVATE_ROOM = 'create private room',
    CREATE_ROOM_ERROR = 'create room error',
    CREATE_ROOM_SUCCESS = 'create room success',
    JOIN_ROOM = 'join room',
    LEAVE_ROOM = 'leave room',
    INVITE_TO_JOIN_ROOM = 'invite to join room',
    REQUEST_TO_JOIN_ROOM = 'request to join room',
    ROOM_MESSAGE = 'room message',
    ROOM_USERS = 'room users',
    ROOM_USER_COUNT = 'room user count',
    ROOMS = 'rooms',
    ROOM_CREATED = 'room created',
    ROOM_JOINED = 'room joined',
    ROOM_LEFT = 'room left',
    ROOM_DELETED = 'room deleted',
}

export interface CommUser {
    username: string;
    socketId: string;
    socket: Socket;
}

export class Communication {
    private sessions: Map<string, Socket> = new Map<string, Socket>();
    private users: Map<string, CommUser> = new Map<string, CommUser>();
    private rooms: Map<string, Room> = new Map<string, Room>();

    constructor(private io: Server) {

        io.on('connection', (socket) => {
            console.log('a user connected to root');
            this.sessions.set(socket.id, socket);

            if (!this.users.has(socket.id)) {
                console.log('Unknown user, requesting username');
                socket.emit(MessageType.REQUEST_USERNAME);
            }


            this.broadcastOnlineUsers();

            socket.on('disconnect', () => {
                const user = this.users.get(socket.id);
                if (user) {
                    console.log(`${user.username} disconnected`);
                } else {
                    console.log('user disconnected');
                }
                this.sessions.delete(socket.id);
                this.users.delete(socket.id);
                this.broadcastOnlineUsers();
            });


            // // user sets username

            socket.on(MessageType.SET_USERNAME, (username) => {
                if (!username) {
                    socket.emit(MessageType.USERNAME_ERROR, `Username cannot be empty`);
                    return;
                }
                if (Array.from(this.users.keys()).some(k => this.users.get(k)?.username === username)) {
                    socket.emit(MessageType.USERNAME_ERROR, `Username ${username} already exists`);
                    return;
                }

                const existingUser = this.users.get(socket.id)
                console.log('setting username: ' + username);
                this.users.set(socket.id, {
                    username,
                    socketId: socket.id,
                    socket: socket
                });

                if (existingUser && existingUser.username) {
                    socket.emit(MessageType.USERNAME_SUCCESS, `Changed username from ${existingUser.username} to ${username}`);
                } else {
                    socket.emit(MessageType.USERNAME_SUCCESS, `Login successfully, welcome ${username}!`)
                }

                this.broadcastOnlineUsers();
            });

            // user creates a room
            socket.on(MessageType.CREATE_ROOM, (roomName: string = v4(), isPrivate = false) => {

                const user = this.getUser(socket.id);
                if (!user) {
                    return;
                }

                const room = this.createRoom(roomName);
                room.isPrivate = isPrivate;
                room.owner = user.username;

                room.addUser(user);
                socket.emit(MessageType.ROOM_CREATED, roomName);

                if (!isPrivate) {
                    io.emit(MessageType.ROOMS, this.roomsPayload(Array.from(this.rooms.values()).filter(r => !r.isPrivate)));
                } else {
                    socket.emit(MessageType.ROOMS, this.roomsPayload(Array.from(this.rooms.values())));
                }

                console.log('user ' + user.username + ' created room: ' + roomName);
            });

            // user sends a message
            socket.on(MessageType.CHAT_MESSAGE, (msg) => {
                console.log('message: ' + msg);
                this.broadcastMessage(socket.id, msg);
            });

            // user requests room list
            socket.on(MessageType.LIST_ROOMS, () => {
                console.log('Requesting rooms list')
                const user = this.getUser(socket.id);
                if (!user) {
                    console.log('User not found')
                    return;
                }

                const rooms = Array.from(this.rooms.values()).filter(r => !r.isPrivate || r.owner === user.username || r.isJoined(socket.id));
                const payload = this.roomsPayload(rooms)
                console.log("Sending rooms list", payload)
                socket.emit(MessageType.ROOMS, payload);
            });

        });

        console.log("Created new Communication instance")

        this.createRoom('lobby');
        this.createRoom('general');
        this.createRoom('random');
    }

    getUser(socketId: string) {
        return this.users.get(socketId);
    }

    broadcastMessage(socketId: string, message: string) {
        this.io.emit(MessageType.CHAT_MESSAGE, {
            sender: this.getUser(socketId)?.username,
            type: MessageType.CHAT_MESSAGE,
            content: message,
            timestamp: new Date()
        });
    }

    private roomsPayload(rooms: Room[]) {
        return rooms.map(r => ({
            name: r.getName(),
            owner: r.owner,
            isPrivate: r.isPrivate,
            numUsers: r.countUsers()
        }))
    }

    broadcastOnlineUsers() {
        this.io.emit(MessageType.ONLINE_USERS, Array.from(this.users.values()).map(u => u.username));
    }

    createRoom(roomName: string = v4()) {

        const room = new Room(this.io, roomName);

        this.rooms.set(roomName, room);

        return room;
    }

}