const fs = require("fs");
const pdfParse = require("pdf-parse");
const axios = require("axios");
const { MongoClient } = require("mongodb");
const config = require("./config.json");

const directoryPath = "./pdfs"; // Directory where your PDF files are stored
const embeddingEndpoint = `http://localhost:${config.port}/embedding`;

// MongoDB client
const client = new MongoClient(config.mongoDB.mongoUri);
const dbName = config.mongoDB.dbName;
const collectionName = config.mongoDB.collectionName;

// Read the PDF files from the pdfs directory
async function readPDFsAndEmbed(directoryPath) {
  try {
    await client.connect();
    console.log("Connected successfully to MongoDB server");
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const files = fs
      .readdirSync(directoryPath)
      .filter((file) => file.endsWith(".pdf"));

    // Process the pdf files
    for (const file of files) {
      console.log(`Processing file: ${file}`);
      const filePath = `${directoryPath}/${file}`;
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);

      // Assuming each sentences is separated by ". "
      const sentences = data.text.split(". ");

      // Initialize pageNumber to 1 at the start.
      let pageNumber = 1;

      // Iterate over each sentence in the sentences array.
      for (const sentence of sentences) {
        // Make an asynchronous POST request to the embedding endpoint with the current sentence.
        // The sentence is JSON stringified before sending.
        const response = await axios.post(embeddingEndpoint, {
          text: JSON.stringify(sentence),
        });

        // Extract the embeddings from the response data.
        const embedding = response.data.embeddings;

        // Insert a new document into the MongoDB collection with the sentence, its embedding,
        // the current PDF file name, and the current page number.
        await collection.insertOne({
          pdfFileName: file, // The name of the PDF file being processed.
          sentence, // The current sentence being processed.
          pageNumber, // The page number where the sentence was found.
          embedding, // The embedding of the current sentence.
        });

        // Check if the sentence contains the page separator "\n\n".
        // If so, increment the pageNumber variable to indicate a new page.
        if (/\n\n/.test(sentence)) {
          pageNumber++;
        }
      }
    }

    console.log("All PDFs processed and embeddings stored.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

readPDFsAndEmbed(directoryPath);
