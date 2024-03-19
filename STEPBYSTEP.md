# Step by step setup

## Overview

1. Create MongoDB Atlas Account and deploy Free-tier Cluster.
   Refer to:
   https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/

2. Create a Google project and enable Vertex AI api:s.  
   Refer to: https://cloud.google.com/vertex-ai/docs/start/cloud-environment

3. Start the `Backend`.

4. Generate embeddings for your content.

5. Create Atlas Vector Search index.  
   Refer to: https://www.mongodb.com/docs/atlas/atlas-vector-search/create-index/

6. Start the `Frontend`.

## 1. Create MongoDB Atlas Account and deploy Free-tier Cluster

Refer to:
https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/

## 2. Create a Google Project and enable Vertex AI api:s

Refer to: https://cloud.google.com/vertex-ai/docs/start/cloud-environment

> Note before starting the backend,  
> Login in the terminal using the gcloud CLI using:  
> `gcloud auth application-default login`

## 3. Start the `Backend`

Open a terminal.  
Clone the repository and install the dependencies:

```bash
git clone https://github.com/voxic/GCP_RAG_Chatbot.git
cd GCP_RAG_Chatbot/backend
npm install
```

Configure the `Backend`. Edit the file `backend/config.json`
And add the `URI` for your MongoDB Cluster and your `GCP Project`.

Run the backend

```bash
npm start
```

## 4. Generate embeddings for your content

To run this process, ensure your MongoDB instance is accessible and that the backend server is running. Execute the script to process all PDF files in the `pdfs` folder, extracting text, generating embeddings, and storing the data in MongoDB for use by the chatbot.

```bash

node processPdf.js

```

> Note: The `processPdf.js` is located in the `backend` folder. And uses the `config.json` configuration file.

## 5. Create Atlas Vector Search index

Refer to: https://www.mongodb.com/docs/atlas/atlas-vector-search/create-index/

The vector search index should be named: `vector_index`.

> Make sure you create the index on the _database_ and _collection_ you stored the embeddings in.

Vector Search Index definition:

```json
{
  "fields": [
    {
      "numDimensions": 768,
      "path": "embedding",
      "similarity": "euclidean",
      "type": "vector"
    }
  ]
}
```

## 6. Start the `Frontend`

Open a new terminal window and navigate to the frontend folder and install the dependencies:

```bash
cd GCP_RAG_Chatbot/frontend
npm install
```

Check the frontend configuration file, `src/config.js` and make sure the backend port is correct according to the `backend/config.json` file.

Start the frontend:

```bash
npm start
```
