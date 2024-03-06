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

      let pageNumber = 1;
      for (const sentence of sentences) {
        const response = await axios.post(embeddingEndpoint, {
          text: JSON.stringify(sentence),
        });
        const embedding = response.data.embeddings;

        await collection.insertOne({
          pdfFileName: file,
          sentence,
          pageNumber,
          embedding,
        });

        // Assuming each page is separated by "\n\n"
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
