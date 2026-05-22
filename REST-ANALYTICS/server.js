const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const z = require("zod");

const app = express();
const port = 8001;

app.use(express.json());

const client = new MongoClient("mongodb://localhost:27017");
let db;

const baseShape = {
  source: z.string(),
  url: z.string(),
  visitor: z.string(),
  createdAt: z.coerce.date().optional(),
  meta: z.record(z.string(), z.any()).optional(),
};

const ViewSchema = z.object({ ...baseShape });
const ActionSchema = z.object({ ...baseShape, action: z.string() });
const GoalSchema = z.object({ ...baseShape, goal: z.string() });

function formatZodError(error) {
  return { message: "Invalid request body", errors: z.flattenError(error) };
}

function resourceRouter(collectionName, createSchema) {
  const router = express.Router();
  const patchSchema = createSchema
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    });

  router.post("/", async (req, res) => {
    const result = createSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).send(formatZodError(result.error));
    }

    const document = {
      ...result.data,
      createdAt: result.data.createdAt ?? new Date(),
      meta: result.data.meta ?? {},
    };

    const ack = await db.collection(collectionName).insertOne(document);
    return res.status(201).send({ _id: ack.insertedId, ...document });
  });

  router.get("/", async (_req, res) => {
    const documents = await db.collection(collectionName).find({}).toArray();
    return res.send(documents);
  });

  router.get("/:id", async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid id" });
    }

    const document = await db
      .collection(collectionName)
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!document) {
      return res.status(404).send({ message: "Not found" });
    }

    return res.send(document);
  });

  router.put("/:id", async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid id" });
    }

    const result = createSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).send(formatZodError(result.error));
    }

    const document = {
      ...result.data,
      createdAt: result.data.createdAt ?? new Date(),
      meta: result.data.meta ?? {},
    };

    const updated = await db
      .collection(collectionName)
      .findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        { $set: document },
        { returnDocument: "after" }
      );

    if (!updated) {
      return res.status(404).send({ message: "Not found" });
    }

    return res.send(updated);
  });

  router.patch("/:id", async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid id" });
    }

    const result = patchSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).send(formatZodError(result.error));
    }

    const updated = await db
      .collection(collectionName)
      .findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        { $set: result.data },
        { returnDocument: "after" }
      );

    if (!updated) {
      return res.status(404).send({ message: "Not found" });
    }

    return res.send(updated);
  });

  router.delete("/:id", async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid id" });
    }

    const deleted = await db
      .collection(collectionName)
      .findOneAndDelete({ _id: new ObjectId(req.params.id) });

    if (!deleted) {
      return res.status(404).send({ message: "Not found" });
    }

    return res.send(deleted);
  });

  return router;
}

app.use("/views", resourceRouter("views", ViewSchema));
app.use("/actions", resourceRouter("actions", ActionSchema));

const goalsRouter = resourceRouter("goals", GoalSchema);

goalsRouter.get("/:goalId/details", async (req, res) => {
  if (!ObjectId.isValid(req.params.goalId)) {
    return res.status(400).send({ message: "Invalid goal id" });
  }

  const result = await db
    .collection("goals")
    .aggregate([
      { $match: { _id: new ObjectId(req.params.goalId) } },
      {
        $lookup: {
          from: "views",
          localField: "visitor",
          foreignField: "visitor",
          as: "views",
        },
      },
      {
        $lookup: {
          from: "actions",
          localField: "visitor",
          foreignField: "visitor",
          as: "actions",
        },
      },
    ])
    .toArray();

  if (result.length === 0) {
    return res.status(404).send({ message: "Goal not found" });
  }

  return res.send(result[0]);
});

app.use("/goals", goalsRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).send({ message: "Internal server error" });
});

client.connect().then(() => {
  db = client.db("analytics");
  app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
});
