const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Marketplace API",
      version: "1.0.0",
      description:
        "API REST d'une marketplace de jeux : produits, utilisateurs, commandes, avis et jeux Free-to-Play.",
    },
    servers: [{ url: "http://localhost:8000" }],
    paths: {
      "/products": {
        get: {
          tags: ["Products"],
          summary: "Liste des produits avec recherche",
          parameters: [
            { name: "name", in: "query", schema: { type: "string" }, description: "Filtre sur le titre (contient)" },
            { name: "about", in: "query", schema: { type: "string" }, description: "Filtre sur la description (contient)" },
            { name: "price", in: "query", schema: { type: "number" }, description: "Prix maximum (<=)" },
          ],
          responses: {
            200: { description: "Liste des produits", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Product" } } } } },
            400: { description: "Paramètres de recherche invalides", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          tags: ["Products"],
          summary: "Créer un produit",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ProductInput" } } } },
          responses: {
            200: { description: "Produit créé", content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } } },
            400: { description: "Corps de requête invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/products/{id}": {
        get: {
          tags: ["Products"],
          summary: "Récupérer un produit (avec ses avis)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Produit avec ses avis", content: { "application/json": { schema: { $ref: "#/components/schemas/ProductWithReviews" } } } },
            404: { description: "Produit introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        delete: {
          tags: ["Products"],
          summary: "Supprimer un produit",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Produit supprimé", content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } } },
            404: { description: "Produit introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/users": {
        get: {
          tags: ["Users"],
          summary: "Liste des utilisateurs",
          responses: { 200: { description: "Liste des utilisateurs", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/User" } } } } } },
        },
        post: {
          tags: ["Users"],
          summary: "Créer un utilisateur",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UserInput" } } } },
          responses: {
            201: { description: "Utilisateur créé", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
            400: { description: "Corps de requête invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            409: { description: "Username ou email déjà utilisé", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/users/{id}": {
        get: {
          tags: ["Users"],
          summary: "Récupérer un utilisateur",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Utilisateur", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
            400: { description: "Id invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Utilisateur introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        put: {
          tags: ["Users"],
          summary: "Remplacer un utilisateur",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UserInput" } } } },
          responses: {
            200: { description: "Utilisateur mis à jour", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
            400: { description: "Corps ou id invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Utilisateur introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            409: { description: "Username ou email déjà utilisé", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        patch: {
          tags: ["Users"],
          summary: "Mettre à jour partiellement un utilisateur",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UserPatch" } } } },
          responses: {
            200: { description: "Utilisateur mis à jour", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
            400: { description: "Corps ou id invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Utilisateur introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            409: { description: "Username ou email déjà utilisé", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        delete: {
          tags: ["Users"],
          summary: "Supprimer un utilisateur",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Utilisateur supprimé", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
            400: { description: "Id invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Utilisateur introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/orders": {
        get: {
          tags: ["Orders"],
          summary: "Liste des commandes (avec user et produits complets)",
          responses: { 200: { description: "Liste des commandes", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Order" } } } } } },
        },
        post: {
          tags: ["Orders"],
          summary: "Créer une commande",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/OrderInput" } } } },
          responses: {
            201: { description: "Commande créée", content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } } },
            400: { description: "Corps de requête invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "User ou produit introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/orders/{id}": {
        get: {
          tags: ["Orders"],
          summary: "Récupérer une commande",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Commande", content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } } },
            400: { description: "Id invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Commande introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        put: {
          tags: ["Orders"],
          summary: "Remplacer une commande",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/OrderUpdate" } } } },
          responses: {
            200: { description: "Commande mise à jour", content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } } },
            400: { description: "Corps ou id invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Commande, user ou produit introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        patch: {
          tags: ["Orders"],
          summary: "Mettre à jour partiellement une commande",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/OrderInput" } } } },
          responses: {
            200: { description: "Commande mise à jour", content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } } },
            400: { description: "Corps ou id invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Commande, user ou produit introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        delete: {
          tags: ["Orders"],
          summary: "Supprimer une commande",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Commande supprimée", content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } } },
            400: { description: "Id invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Commande introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/reviews": {
        get: {
          tags: ["Reviews"],
          summary: "Liste des avis (filtrable par productId / userId)",
          parameters: [
            { name: "productId", in: "query", schema: { type: "integer" } },
            { name: "userId", in: "query", schema: { type: "integer" } },
          ],
          responses: {
            200: { description: "Liste des avis", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Review" } } } } },
            400: { description: "Paramètres invalides", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          tags: ["Reviews"],
          summary: "Créer un avis (met à jour le produit associé)",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ReviewInput" } } } },
          responses: {
            201: { description: "Avis créé", content: { "application/json": { schema: { $ref: "#/components/schemas/Review" } } } },
            400: { description: "Corps de requête invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "User ou produit introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/reviews/{id}": {
        get: {
          tags: ["Reviews"],
          summary: "Récupérer un avis",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Avis", content: { "application/json": { schema: { $ref: "#/components/schemas/Review" } } } },
            400: { description: "Id invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Avis introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        put: {
          tags: ["Reviews"],
          summary: "Remplacer un avis",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ReviewUpdate" } } } },
          responses: {
            200: { description: "Avis mis à jour", content: { "application/json": { schema: { $ref: "#/components/schemas/Review" } } } },
            400: { description: "Corps ou id invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Avis, user ou produit introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        patch: {
          tags: ["Reviews"],
          summary: "Mettre à jour partiellement un avis",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ReviewPatch" } } } },
          responses: {
            200: { description: "Avis mis à jour", content: { "application/json": { schema: { $ref: "#/components/schemas/Review" } } } },
            400: { description: "Corps ou id invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Avis introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        delete: {
          tags: ["Reviews"],
          summary: "Supprimer un avis (recalcule le score du produit)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Avis supprimé", content: { "application/json": { schema: { $ref: "#/components/schemas/Review" } } } },
            400: { description: "Id invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Avis introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/f2p-games": {
        get: {
          tags: ["F2P Games"],
          summary: "Liste des jeux Free-to-Play (service FreeToGame)",
          responses: {
            200: { description: "Liste des jeux" },
            502: { description: "Service FreeToGame indisponible", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/f2p-games/{id}": {
        get: {
          tags: ["F2P Games"],
          summary: "Récupérer un jeu Free-to-Play",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Détail du jeu" },
            400: { description: "Id invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Jeu introuvable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            502: { description: "Service FreeToGame indisponible", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
    },
    components: {
      schemas: {
        Product: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            name: { type: "string", example: "My first game" },
            about: { type: "string", example: "This is an awesome game" },
            price: { type: "number", format: "float", example: 60 },
            review_ids: {
              type: "array",
              items: { type: "integer" },
              example: [1, 2],
            },
            score: {
              type: "number",
              format: "float",
              nullable: true,
              example: 4.5,
              description: "Score moyen calculé à partir des avis",
            },
          },
        },
        ProductWithReviews: {
          allOf: [
            { $ref: "#/components/schemas/Product" },
            {
              type: "object",
              properties: {
                reviews: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Review" },
                },
              },
            },
          ],
        },
        ProductInput: {
          type: "object",
          required: ["name", "about", "price"],
          properties: {
            name: { type: "string", example: "My first game" },
            about: { type: "string", example: "This is an awesome game" },
            price: { type: "number", format: "float", example: 60 },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            username: { type: "string", example: "johan" },
            email: { type: "string", format: "email", example: "johan@example.com" },
          },
          description: "Le mot de passe n'est jamais renvoyé par l'API.",
        },
        UserInput: {
          type: "object",
          required: ["username", "email", "password"],
          properties: {
            username: { type: "string", example: "johan" },
            email: { type: "string", format: "email", example: "johan@example.com" },
            password: { type: "string", format: "password", example: "s3cret" },
          },
        },
        UserPatch: {
          type: "object",
          minProperties: 1,
          properties: {
            username: { type: "string", example: "johan" },
            email: { type: "string", format: "email", example: "johan@example.com" },
            password: { type: "string", format: "password", example: "s3cret" },
          },
        },
        Order: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            userId: { type: "integer", example: 1 },
            productIds: { type: "array", items: { type: "integer" }, example: [1, 2] },
            total: {
              type: "number",
              format: "float",
              example: 144,
              description: "Somme du prix des produits * 1.2 (TVA)",
            },
            payment: { type: "boolean", example: false },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            user: { $ref: "#/components/schemas/User" },
            products: { type: "array", items: { $ref: "#/components/schemas/Product" } },
          },
        },
        OrderInput: {
          type: "object",
          required: ["userId", "productIds"],
          properties: {
            userId: { type: "integer", example: 1 },
            productIds: { type: "array", items: { type: "integer" }, example: [1, 2] },
            payment: { type: "boolean", example: false },
          },
        },
        OrderUpdate: {
          type: "object",
          required: ["userId", "productIds", "payment"],
          properties: {
            userId: { type: "integer", example: 1 },
            productIds: { type: "array", items: { type: "integer" }, example: [1, 2] },
            payment: { type: "boolean", example: true },
          },
        },
        Review: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            userId: { type: "integer", example: 1 },
            productId: { type: "integer", example: 1 },
            score: { type: "integer", minimum: 1, maximum: 5, example: 4 },
            content: { type: "string", example: "Très bon jeu !" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ReviewInput: {
          type: "object",
          required: ["userId", "productId", "score"],
          properties: {
            userId: { type: "integer", example: 1 },
            productId: { type: "integer", example: 1 },
            score: { type: "integer", minimum: 1, maximum: 5, example: 4 },
            content: { type: "string", example: "Très bon jeu !" },
          },
        },
        ReviewUpdate: {
          type: "object",
          required: ["userId", "productId", "score"],
          properties: {
            userId: { type: "integer", example: 1 },
            productId: { type: "integer", example: 1 },
            score: { type: "integer", minimum: 1, maximum: 5, example: 5 },
            content: { type: "string", example: "Encore mieux après la mise à jour" },
          },
        },
        ReviewPatch: {
          type: "object",
          minProperties: 1,
          properties: {
            score: { type: "integer", minimum: 1, maximum: 5, example: 5 },
            content: { type: "string", example: "Avis mis à jour" },
          },
        },
        Error: {
          type: "object",
          properties: { message: { type: "string", example: "Not found" } },
        },
      },
    },
  },
  apis: [],
};

module.exports = swaggerJsdoc(options);
