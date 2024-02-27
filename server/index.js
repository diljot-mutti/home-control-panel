require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");

const webPush = require("web-push");
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
webPush.setVapidDetails(process.env.VAPID_SUBJECT, publicKey, privateKey);

const app = express();
const server = http.createServer(app);
const storage = require("node-persist");

// anonymous async function to initialize the storage

(async function () {
  console.log("Initializing storage");
  await storage.init({
    dir: "storage",
    expiredInterval: 10 * 60 * 1000, // every 10 minutes the process will clean-up the expired cache
  });
})();

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    transports: ["websocket", "polling"],
    credentials: true,
  },
  allowEIO3: true,
});

app.use(cors());
app.use(bodyParser.json());

let lock = {};
let clients = [];
let lockStatus = "UNKNOWN";

io.on("connection", (socket) => {
  console.log("Client connected: ", socket.id);

  // Listen for messages from the client
  //temporary
  socket.on("snd_message", (msg) => {
    console.log(`Message from client with id - ${socket.id}:`, msg);
    io.sockets.emit("message", msg);
  });

  // first message on lock connection
  socket.on("signup_lock", ({ lockId }) => {
    console.log(lockId);
    console.log(`New Lock ${lockId} registered with socketId - ${socket.id}`);
    lock = { socketId: socket.id, uniqueId: lockId };
  });

  // first message on client connection
  socket.on("signup_client", () => {
    console.log(`New client registered with socketId - ${socket.id}`);
    clients.push({ socketId: socket.id });
    socket.join("dilshine_users");
    socket.emit("lock_status_change", {
      lockId: lock.uniqueId,
      lock_status: lockStatus,
    });
  });

  // Listen for lock status change
  socket.on("lock_status_change", (msg) => {
    let { lockId, lockPinState, unlockPinState } = msg;
    console.log(`Lock status changed for ${lockId}`);

    if (lockPinState == 1 && unlockPinState == 0) {
      lockStatus = "LOCKED";
    } else if (lockPinState == 0 && unlockPinState == 1) {
      lockStatus = "UNLOCKED";
    } else {
      console.log("Stuck");
      console.log(`lock pin -> ${lockPinState} -- unlock pin -> ${unlockPinState}`);
      lockStatus = "STUCK";
    }

    const payload = {
      lockId: lockId,
      lock_status: lockStatus,
    };

    // Send the lock status change to all clients in the "dilshine_users" room
    io.to("dilshine_users").emit("lock_status_change", payload);
  });

  //listen to unlock request
  socket.on("unlock_request", (msg) => {
    console.log("Unlock request received");
    io.to(lock.socketId).emit("unlock_request", "Unlock request received");
  });

  socket.on("lock_request", (msg) => {
    console.log("Unlock request received");
    io.to(lock.socketId).emit("lock_request", "Lock request received");
  });

  // Clean up the socket connection when the client disconnects
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });

  socket.on("error", function (err) {
    console.log("received error from client:", socket.id);
    console.log(err);

    // if (err.description) throw err.description;
    // else throw err; // Or whatever you want to do
  });
});

let subscriptions = [];

app.post("/subscribe", async (req, res) => {
  console.log(req.body);
  const { subscription, id } = req.body;
  await storage.updateItem("subscriptions", subscription);
  // console.log(subscription);
  // subscriptions.push(subscription);

  res.status(201).json({});
  const payload = JSON.stringify({ title: "Subscribed to Push notifications!" });
  webPush.sendNotification(subscription, payload).catch((err) => console.error(err));
});

app.get("/test", (req, res) => {
  console.log("Test endpoint hit");
  title = "Test";
  message = "Test message";
  const payload = JSON.stringify({ title, message });

  let subs = storage.getItem("subscriptions");

  subs.forEach((subscription) => {
    webPush
      .sendNotification(subscription, payload)
      .catch((error) => {
        console.error("Error sending notification, reason: ", error);
        // return res.status(400).json({ data: { success: false } });
      })
      .then((value) => {
        console.log("Notification sent successfully");
      });
  });
  return res.status(201).json({ data: { success: true } });
});

const PORT = process.env.PORT || 3015;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
