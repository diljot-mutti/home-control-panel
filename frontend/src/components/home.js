import React, { useState, useEffect } from "react";
import Chip from "@mui/material/Chip";

// Typography
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Container from "@mui/material/Container";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

import { socket } from "../common/socket";

// import { useSubscribe } from "react-pwa-push-notifications";
import { useSubscribe } from "../common/subscribeHook";

import axios from "axios";

const PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

const Welcome = (props) => {
  const [message, setMessage] = useState("");
  const [receivedMessages, setReceivedMessages] = useState([]);
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [lockStatus, setLockStatus] = useState("Unknown");
  const [subscribeId, setSubscribeId] = useState(null);
  const { getSubscription } = useSubscribe({ publicKey: PUBLIC_KEY });
  const [errString, setErrString] = useState("");
  const [lockConnectionStatus, setLockConnectionStatus] = useState("OFFLINE");
  const [lockStatusUpdatedTime, setLockStatusUpdatedTime] = useState(new Date(2020, 0, 1, 0, 0, 0, 0));

  async function init() {
    console.log("Getting subscription");
    try {
      const subscription = await getSubscription().catch((e) => {
        console.log("Error getting subscription:", e);
        setErrString(JSON.stringify(e));
      });

      await axios.post(process.env.REACT_APP_API_URL, {
        subscription: subscription,
        id: subscribeId,
      });
    } catch (e) {
      setErrString(JSON.stringify(e));
      console.log(e);
    }
  }

  useEffect(() => {
    init();
    // Update socket status when connecting
    socket.on("connect", () => {
      console.log("Connected!");
      setSocketStatus("connected");
      socket.emit("signup_client");
    });

    // Update socket status when disconnecting
    socket.on("disconnect", () => {
      setSocketStatus("disconnected");
      console.log("disc -- status is :", socket.connected); // Log connection status
    });

    // Update socket status when reconnecting
    socket.on("reconnect", () => {
      console.log("Reconnecting...");
      setSocketStatus("connected");
    });

    socket.on("message", (msg) => {
      console.log("Received message:", msg);
      setReceivedMessages((prevMessages) => [...prevMessages, msg]);
    });

    // update lock status when lock status changes
    socket.on("lock_status_change", (data) => {
      console.log("Lock status changed:", data);
      setLockStatus(data.lock_status);
      setLockConnectionStatus(data.lockConnectionStatus);
      setLockStatusUpdatedTime(data.lockStatusUpdatedTime);
    });
  }, []);

  useEffect(() => {
    FingerprintJS.load()
      .then((fp) => fp.get())
      .then((result) => {
        console.log("VisitorId:", result.visitorId);
        setSubscribeId(result.visitorId);
      });
  }, []);

  const sendMessage = () => {
    //log if connected
    if (socket.connected) {
      console.log("Socket is connected");
    } else {
      console.log("Socket is not connected");
    }

    console.log("Sending message:", message);
    // handle error
    socket.emit("snd_message", message);

    setMessage("");
  };

  const handleUnlock = () => {
    socket.emit("unlock_request");
  };

  const handleLock = () => {
    socket.emit("lock_request");
  };

  return (
    <Container>
      <Button
        onClick={() => {
          init();
        }}>
        Init
      </Button>

      <p>{errString}</p>
      <Grid>
        <Typography
          variant="h4"
          sx={{
            textAlign: "center",
            marginTop: "20px",
            marginBottom: "20px",
          }}>
          Lock Control System
        </Typography>

        <Typography
          variant="h6"
          sx={{
            textAlign: "center",
          }}>
          Server Status:{" "}
          <Chip
            //uppercase
            size="small"
            label={`${socketStatus.toUpperCase()}`}
            color={socketStatus === "connected" ? "success" : socketStatus === "connecting" ? "warning" : "error"}
          />
        </Typography>
        <Typography
          variant="h6"
          sx={{
            textAlign: "center",
          }}>
          Lock Status:{" "}
          <Chip
            //uppercase
            label={`${lockConnectionStatus.toUpperCase()}`}
            size="small"
            color={lockConnectionStatus === "ONLINE" ? "success" : "error"}
          />
        </Typography>
        <Box
          display={"flex"}
          justifyContent={"center"}
          sx={{
            marginTop: "60px",
            marginBottom: "5px",
          }}>
          <Box
            component="img"
            display={"flex"}
            justifyContent={"center"}
            alignItems={"center"}
            sx={{
              width: "40%",
              maxWidth: "200px",
            }}
            src={lockStatus == "LOCKED" ? "/lock.png" : "/unlock.png"}
          />
        </Box>

        <Typography
          variant="body1"
          sx={{
            textAlign: "center",
          }}>
          {lockStatus}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            textAlign: "center",
            color: "text.secondary",
          }}>
          {/* local time */}
          {new Date(lockStatusUpdatedTime).toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}{" "}
          {new Date(lockStatusUpdatedTime).toLocaleTimeString()}
        </Typography>

        <Box sx={{ display: "flex", justifyContent: "center", mt: "40px" }}>
          <Button
            variant="contained"
            color="error"
            // disabled={lockStatus == "UNLOCKED"}
            onClick={() => {
              handleUnlock();
            }}>
            Allow
          </Button>
          <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          <Button
            variant="contained"
            color="success"
            // disabled={lockStatus == "UNLOCKED"}
            onClick={() => {
              handleLock();
            }}>
            Block
          </Button>
        </Box>

        {/* <Box
          sx={{
            marginTop: "50px",
            marginBottom: "20px",
          }}>
          <div>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
          <div>
            <h2>Received Messages:</h2>
            <ul>
              {receivedMessages.map((msg, index) => (
                <li key={index}>{msg}</li>
              ))}
            </ul>
          </div>
        </Box> */}
      </Grid>
    </Container>
  );
};

export default Welcome;
