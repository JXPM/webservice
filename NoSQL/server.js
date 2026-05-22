const express = require("express");
const { createServer } = require("node:http");
const { MongoClient, ObjectId } = require("mongodb");
const { Server } = require("socket.io");
const z = require("zod");

const app = express();
const port = 8000;

app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer);

const client = new MongoClient("mongodb://localhost:27017");
let db;

const CreateProductSchema = z.object({
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
  categoryIds: z.array(z.string()).optional().default([]),
});

const UpdateProductSchema = CreateProductSchema;

const PatchProductSchema = z
  .object({
    name: z.string().optional(),
    about: z.string().optional(),
    price: z.number().positive().optional(),
    categoryIds: z.array(z.string()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

function formatZodError(error) {
  return { message: "Invalid request body", errors: z.flattenError(error) };
}

function toCategoryObjectIds(categoryIds) {
  if (categoryIds.some((id) => !ObjectId.isValid(id))) {
    return null;
  }

  return categoryIds.map((id) => new ObjectId(id));
}

function emitProductChange(type, product) {
  io.emit("products", { type, product });
}

app.post("/products", async (req, res) => {
  const result = CreateProductSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(formatZodError(result.error));
  }

  const { name, about, price, categoryIds } = result.data;
  const categoryObjectIds = toCategoryObjectIds(categoryIds);

  if (categoryObjectIds === null) {
    return res.status(400).send({ message: "Invalid categoryIds" });
  }

  const ack = await db
    .collection("products")
    .insertOne({ name, about, price, categoryIds: categoryObjectIds });

  const product = { _id: ack.insertedId, name, about, price, categoryIds: categoryObjectIds };
  emitProductChange("create", product);

  return res.status(201).send(product);
});

app.get("/products", async (_req, res) => {
  const products = await db.collection("products").find({}).toArray();
  return res.send(products);
});

app.get("/products/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).send({ message: "Invalid product id" });
  }

  const product = await db
    .collection("products")
    .findOne({ _id: new ObjectId(req.params.id) });

  if (!product) {
    return res.status(404).send({ message: "Product not found" });
  }

  return res.send(product);
});

app.put("/products/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).send({ message: "Invalid product id" });
  }

  const result = UpdateProductSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(formatZodError(result.error));
  }

  const { name, about, price, categoryIds } = result.data;
  const categoryObjectIds = toCategoryObjectIds(categoryIds);

  if (categoryObjectIds === null) {
    return res.status(400).send({ message: "Invalid categoryIds" });
  }

  const product = await db.collection("products").findOneAndUpdate(
    { _id: new ObjectId(req.params.id) },
    { $set: { name, about, price, categoryIds: categoryObjectIds } },
    { returnDocument: "after" }
  );

  if (!product) {
    return res.status(404).send({ message: "Product not found" });
  }

  emitProductChange("update", product);
  return res.send(product);
});

app.patch("/products/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).send({ message: "Invalid product id" });
  }

  const result = PatchProductSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(formatZodError(result.error));
  }

  const updates = { ...result.data };

  if (updates.categoryIds !== undefined) {
    const categoryObjectIds = toCategoryObjectIds(updates.categoryIds);

    if (categoryObjectIds === null) {
      return res.status(400).send({ message: "Invalid categoryIds" });
    }

    updates.categoryIds = categoryObjectIds;
  }

  const product = await db
    .collection("products")
    .findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updates },
      { returnDocument: "after" }
    );

  if (!product) {
    return res.status(404).send({ message: "Product not found" });
  }

  emitProductChange("update", product);
  return res.send(product);
});

app.delete("/products/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).send({ message: "Invalid product id" });
  }

  const product = await db
    .collection("products")
    .findOneAndDelete({ _id: new ObjectId(req.params.id) });

  if (!product) {
    return res.status(404).send({ message: "Product not found" });
  }

  emitProductChange("delete", product);
  return res.send(product);
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).send({ message: "Internal server error" });
});

io.on("connection", (socket) => {
  console.log("Client connecté au websocket:", socket.id);
});

client.connect().then(() => {
  db = client.db("myDB");
  httpServer.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
});
