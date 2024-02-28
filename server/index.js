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
  console.log("Storage initialized");
  // remove all null or undefined values from the storage
  let subs = await storage.getItem("subscriptions");
  if (!subs) {
    subs = [];
  }
  subs = subs.filter((sub) => sub);
  await storage.updateItem("subscriptions", subs);
  console.log("Subscriptions cleaned up");
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
let lockConnectionStatus = "OFFLINE";
let lockStatusUpdatedTime = new Date(2020, 0, 1, 0, 0, 0, 0);

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
    lockConnectionStatus = "ONLINE";
    lock = { socketId: socket.id, uniqueId: lockId };

    sendPushNotification("Lock Online", "Lock is now connected");
  });

  // first message on client connection
  socket.on("signup_client", () => {
    console.log(`New client registered with socketId - ${socket.id}`);
    clients.push({ socketId: socket.id });
    socket.join("dilshine_users");
    socket.emit("lock_status_change", {
      lockId: lock.uniqueId,
      lock_status: lockStatus,
      lockStatusUpdatedTime: lockStatusUpdatedTime,
      lockConnectionStatus: lockConnectionStatus,
    });
  });

  // Listen for lock status change
  socket.on("lock_status_change", (msg) => {
    let { lockId, lockPinState, unlockPinState } = msg;
    console.log(`Lock status changed for ${lockId}`);

    if (lockPinState == 1 && unlockPinState == 0) {
      lockStatus = "LOCKED";
      lockStatusUpdatedTime = new Date();
    } else if (lockPinState == 0 && unlockPinState == 1) {
      lockStatus = "UNLOCKED";
      lockStatusUpdatedTime = new Date();
    } else {
      lockStatus = "STUCK";
      lockStatusUpdatedTime = new Date();
    }

    const payload = {
      lockId: lockId,
      lock_status: lockStatus,
      lockStatusUpdatedTime: lockStatusUpdatedTime,
      lockConnectionStatus: lockConnectionStatus,
    };

    // Send the lock status change to all clients in the "dilshine_users" room
    io.to("dilshine_users").emit("lock_status_change", payload);

    if (lockStatus == "LOCKED" || lockStatus == "UNLOCKED") {
      sendPushNotification("Lock Status Change", `Lock is now ${lockStatus}`);
    }
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
    if (clients.includes(socket.id)) {
      clients = clients.filter((client) => client.socketId !== socket.id);
    }

    if (socket.id == lock.socketId) {
      lock = {};
      lockConnectionStatus = "OFFLINE";
      io.to("dilshine_users").emit("lock_status_change", {
        lockId: lock.uniqueId,
        lock_status: lockStatus,
        lockStatusUpdatedTime: lockStatusUpdatedTime,
        lockConnectionStatus: lockConnectionStatus,
      });

      // Send push notification to all subscribers
      sendPushNotification("Lock Offline", "Lock is now disconnected");
    }

    console.log("Client disconnected: ", socket.id);
  });

  socket.on("error", function (err) {
    console.log("received error from client:", socket.id);
    console.log(err);

    // if (err.description) throw err.description;
    // else throw err; // Or whatever you want to do
  });
});

app.post("/subscribe", async (req, res) => {
  console.log(req.body);
  const { subscription, id } = req.body;

  let subs = await storage.getItem("subscriptions");
  if (!subs) {
    subs = [];
  }
  if (subscription) {
    subs.push(subscription);
  }
  await storage.updateItem("subscriptions", subs);

  res.status(201).json({});
  const payload = JSON.stringify({ title: "Subscribed to Push notifications!" });
  webPush.sendNotification(subscription, payload).catch((err) => console.error(err));
});

app.get("/test", async (req, res) => {
  console.log("Test endpoint hit");
  title = "Test";
  message = "Test message";

  sendPushNotification(title, message);

  return res.status(201).json({ data: { success: true } });
});

const sendPushNotification = async (title, message) => {
  const payload = JSON.stringify({ title, message });

  let subs = await storage.getItem("subscriptions");

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
};

const PORT = process.env.PORT || 3015;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
