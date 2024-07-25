// index.js
const express = require("express");
const { ApolloServer, gql } = require("apollo-server-express");
const Redis = require("ioredis");
const DataLoader = require("dataloader");

const redis = new Redis();

// Mock data source
const users = [
  { id: 1, name: "John Doe" },
  { id: 2, name: "Jane Smith" },
];

// GraphQL schema
const typeDefs = gql`
  type User {
    id: ID!
    name: String!
  }

  type Query {
    user(id: ID!): User
    users: [User]
  }
`;

// Function to fetch user data
const fetchUserById = async (id) => {
  console.log("Fetching user from database:", id);
  return users.find((user) => user.id === parseInt(id));
};

// DataLoader for batching and caching
const userLoader = new DataLoader(async (ids) => {
  const results = await Promise.all(ids.map(fetchUserById));
  return ids.map((id) => results.find((user) => user.id === parseInt(id)));
});

// GraphQL resolvers
const resolvers = {
  Query: {
    user: async (_, { id }) => {
      // Check Redis cache
      const cacheKey = `user:${id}`;
      const cachedUser = await redis.get(cacheKey);

      if (cachedUser) {
        console.log("Returning cached user:", id);
        return JSON.parse(cachedUser);
      }

      // Fetch from DataLoader
      const user = await userLoader.load(id);

      // Store in Redis cache
      await redis.set(cacheKey, JSON.stringify(user), "EX", 60); // Cache for 60 seconds

      return user;
    },
    users: () => users,
  },
};

async function startServer() {
  const app = express();
  const server = new ApolloServer({ typeDefs, resolvers });

  await server.start();
  server.applyMiddleware({ app });

  app.listen({ port: 4000 }, () => {
    console.log(
      "Server is running on http://localhost:4000" + server.graphqlPath
    );
  });
}

startServer();
