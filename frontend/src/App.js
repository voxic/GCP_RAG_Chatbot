import React from "react";
import { useState, useRef, useEffect } from "react";
import {
  Container,
  Paper,
  List,
  ListItem,
  ListItemText,
  TextField,
  Button,
  AppBar,
  Toolbar,
  Typography,
  Chip, // Import the Chip component
  Switch,
  FormControlLabel,
  Stack,
  Box, // Import for the toggle switch label
} from "@mui/material";
import config from "../config";

import "./App.css";

function App() {
  const [messages, setMessages] = useState([
    { text: "Welcome, how can I help?", sender: "Bot" },
  ]);
  const [input, setInput] = useState("");
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false); // State to track if waiting for response
  const [isRAGEnabled, setIsRAGEnabled] = useState(false); // State for the RAG toggle

  const messagesEndRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]); // Triggered every time the messages array changes

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessageToServer = async (userMessage) => {
    setIsWaitingForResponse(true); // Indicate that we're waiting for a response
    try {
      const response = await fetch(
        `http://localhost:${config.backend_port}/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: userMessage, rag: isRAGEnabled }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setIsWaitingForResponse(false); // Response received, no longer waiting
      return data.message; // Assuming the server responds with { message: '...' }
    } catch (error) {
      console.error("Error sending message:", error);
      setIsWaitingForResponse(false); // In case of error, also update the state
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return; // Prevent sending empty messages

    const userMessage = input;
    setMessages((messages) => [
      ...messages,
      { text: userMessage, sender: "user" },
    ]); // Add user message to UI
    setInput(""); // Clear input field

    const botResponse = await sendMessageToServer(userMessage);
    if (botResponse) {
      setMessages((messages) => [
        ...messages,
        { text: botResponse, sender: "bot" },
      ]); // Add bot response to UI
    }
  };

  const handleRAGToggle = (event) => {
    setIsRAGEnabled(event.target.checked);
  };

  return (
    <div>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" style={{ flexGrow: 1 }}>
            Chatbot using RAG
          </Typography>
          <Typography variant="h6" sx={{ marginRight: "10px" }}>
            RAG:
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography>Off</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={isRAGEnabled}
                  onChange={handleRAGToggle}
                  name="ragSwitch"
                  color="default"
                />
              }
              style={{ marginRight: 0 }} // Adjust margin if necessary
            />
            <Typography>On</Typography>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" style={{ marginTop: "75px" }}>
        <Paper style={{ height: "400px", overflow: "auto" }}>
          <List>
            {messages.map((message, index) => (
              <ListItem
                key={index}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems:
                    message.sender === "user" ? "flex-end" : "flex-start",
                }}
              >
                <Box
                  sx={{
                    maxWidth: "80%",
                    padding: "10px",
                    borderRadius: "20px",
                    backgroundColor:
                      message.sender === "user" ? "blue" : "grey",
                    color: "#fff",
                    marginBottom: "10px",
                  }}
                >
                  <Typography variant="body1">{message.text}</Typography>
                </Box>
              </ListItem>
            ))}
            {/* Display Chip with "..." when waiting for response */}
            {isWaitingForResponse && (
              <ListItem>
                <Chip label="..." />
              </ListItem>
            )}
            <div ref={messagesEndRef} />
          </List>
        </Paper>
        <TextField
          fullWidth
          placeholder="Type your message..."
          margin="normal"
          variant="outlined"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          style={{ backgroundColor: "#fff" }}
        />
        <Button variant="contained" color="primary" onClick={handleSend}>
          Send
        </Button>
      </Container>
    </div>
  );
}

export default App;
