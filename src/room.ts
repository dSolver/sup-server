import { Namespace, Server } from "socket.io";
import { CommUser, MessageType } from "./communication";

export interface Message {
    sender: string;
    type: MessageType;
    content: string;
    timestamp: Date;
}

export class Room {
    private users: Map<string, CommUser> = new Map<string, CommUser>();
    private namespace: Namespace;
    private name: string;
    private io: Server;

    public isPrivate: boolean = false;
    public owner: string = '';

    private chatHistory: Message[] = [];

    constructor(_io: Server, _name: string) {
        this.name = _name;
        this.io = _io;

        console.log('room created: ' + this.name);
        this.namespace = this.io.of('/' + this.name);
        this.namespace.on('connection', (socket) => {
            console.log('a user connected to ' + this.name);

            this.broadcastOnlineUsers();

            socket.on('disconnect', () => {
                const user = this.users.get(socket.id);
                if (user) {
                    console.log(`${user.username} disconnected from ${this.name}`);
                } else {
                    console.log(`socket ${socket.id}  disconnected from ${this.name}`);
                }
                this.users.delete(socket.id);
                console.log(this.users);
                this.broadcastOnlineUsers();
            });

            // user sends a message
            socket.on(MessageType.CHAT_MESSAGE, (msg) => {
                console.log('message: ' + msg);

                this.broadcastMessage(socket.id, msg);
            });



            // user sets username
            socket.on(MessageType.SET_USERNAME, (username) => {
                if (!username) {
                    socket.emit(MessageType.USERNAME_ERROR, `Username cannot be empty`);
                    return;
                }
                if (Array.from(this.users.keys()).some(k => this.users.get(k)?.username === username)) {
                    console.log(this.users)
                    socket.emit(MessageType.USERNAME_ERROR, `Username ${username} already exists`);
                    return;
                }

                const existingUser = this.users.get(socket.id)
                console.log(this.name + ': setting username: ' + username);
                this.users.set(socket.id, {
                    username,
                    socketId: socket.id,
                    socket: socket
                });

                if (existingUser && existingUser.username) {
                    socket.emit(MessageType.USERNAME_SUCCESS, `Changed username from ${existingUser.username} to ${username}`);
                } else {
                    socket.emit(MessageType.USERNAME_SUCCESS, `Hello ${username}, welcome to #${this.name}!`)
                }

                this.broadcastOnlineUsers();

                socket.emit(MessageType.CHAT_CATCHUP, this.chatHistory)
            });
        });
    }

    addUser(user: CommUser) {
        this.users.set(user.socketId, user);
        user.socket.join(this.name);
    }

    getUser(socketId: string) {
        return this.users.get(socketId);
    }

    getName() {
        return this.name;
    }

    isJoined(socketId: string) {
        return this.users.has(socketId);
    }

    broadcastMessage(socketId: string, message: string) {
        const payload = {
            sender: this.getUser(socketId)?.username ?? '',
            type: MessageType.CHAT_MESSAGE,
            content: message,
            timestamp: new Date()
        }
        this.namespace.emit(MessageType.CHAT_MESSAGE, payload);

        // add to chat history
        this.chatHistory.push(payload);
    }

    broadcastOnlineUsers() {
        this.namespace.emit(MessageType.ONLINE_USERS, Array.from(this.users.values()).map(u => u.username));
    }

    countUsers() {
        return this.users.size;
    }
}
