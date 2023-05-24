/**
 * bootstraps an express server to port 80
 * 
 */

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

// enable cors
app.use(cors());

// enable helmet
app.use(helmet());

// enable compression
app.use(compression());

// enable morgan
app.use(morgan('combined'));

// enable body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// enable json-server
const jsonServer = require('json-server');

// db.json is in the root directory
const router = jsonServer.router(path.join(__dirname, '..', 'db.json'));
const middlewares = jsonServer.defaults();
app.use('/api', middlewares, router);

// enable socket.io
const io = new Server(server, {
    cors: {
        origin: '*', // allow all origins, this is okay because it is demo only
    }
});

// enable communication
import { Communication } from './communication';
const c = new Communication(io);



server.listen(80);

