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
  Chip,
  Switch,
  FormControlLabel,
  Stack,
  Box,
} from "@mui/material";
import config from "../config";

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

  // Scrolls to the bottom of the messages container smoothly.
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Async function to send a message to the server and handle the response.
  const sendMessageToServer = async (userMessage) => {
    setIsWaitingForResponse(true); // Indicate waiting for server response.

    try {
      // Send POST request to server with userMessage and RAG status.
      const response = await fetch(
        `http://localhost:${config.backend_port}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage, rag: isRAGEnabled }),
        }
      );

      // Check for non-2xx HTTP response.
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json(); // Parse JSON response.
      setIsWaitingForResponse(false); // Reset waiting indicator.
      return data.message; // Return server's message from response.
    } catch (error) {
      console.error("Error sending message:", error); // Log error.
      setIsWaitingForResponse(false); // Reset waiting indicator on error.
    }
  };

  // Async function to handle sending of user messages.
  const handleSend = async () => {
    if (!input.trim()) return; // Ignore empty messages.

    const userMessage = input;
    // Update UI to show user's message.
    setMessages((messages) => [
      ...messages,
      { text: userMessage, sender: "user" },
    ]);
    setInput(""); // Clear the input field.

    // Await response from server after sending user message.
    const botResponse = await sendMessageToServer(userMessage);
    if (botResponse) {
      // Update UI to show bot's response.
      setMessages((messages) => [
        ...messages,
        { text: botResponse, sender: "bot" },
      ]);
    }
  };

  // Toggles the RAG feature based on checkbox input.
  const handleRAGToggle = (event) => {
    setIsRAGEnabled(event.target.checked); // Update RAG enabled state.
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
              style={{ marginRight: 0 }}
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
