import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";
import fs from "node:fs/promises";

const server = new McpServer({
  name: "my-mcp-server",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
    prompts: {},
  },
});

server.resource(
  "all users",
  new ResourceTemplate("users://all", {
    list: undefined,
  }),
  {
    description: "Get users data from web.",
    title: "All Users",
    mimeType: "application/json",
  },
  async (uri) => {
    const response = await fetch("https://jsonplaceholder.typicode.com/users");
    if (!response.ok) {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: "Failed to fetch users",
          },
        ],
      };
    }
    const users = await response.json();

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(users),
        },
      ],
    };
  }
);
server.resource(
  "user-details",
  new ResourceTemplate("users://{user_id}/profile", {
    list: undefined,
  }),
  {
    description: "Get a user detial from the databse.",
    title: "User Details",
    mimeType: "application/json",
  },
  async (uri, { user_id }) => {
    const users = await import("./data/users.json", {
      with: { type: "json" },
    }).then((m) => m.default);

    const user = users.find((user) => user.id == parseInt(user_id as string));
    if (user == null) {
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify({ error: "User not found." }),
            mimeType: "application/json",
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(user),
          mimeType: "application/json",
        },
      ],
    };
  }
),
  server.resource(
    "local users",
    "users://local",
    {
      description: "Get users from the local JSON file",
      title: "Local  Users",
      mimeType: "application/json",
    },
    async (uri) => {
      const users = await import("./data/users.json", {
        with: { type: "json" },
      }).then((m) => m.default);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(users),
          },
        ],
      };
    }
  );

server.tool(
  "create-user",
  "Create a new user in the database",
  {
    name: z.string(),
    email: z.string(),
    address: z.string(),
    phone: z.string(),
  },
  {
    title: "Create User",
    destructiveHint: false,
    idempotentHint: false,
    readOnlyHint: false,
    openWorldHint: true,
  },
  async (params) => {
    try {
      const id = await createUser(params);

      return {
        content: [
          {
            type: "text",
            text: `User ${id} created successfully`,
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: "text",
            text: "Failed to save user",
          },
        ],
      };
    }
  }
);

server.prompt(
  "generate-fake-user",
  "Generate fake user based on given name",
  {
    name: z.string(),
  },
  ({ name }) => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Generate fake user with the name ${name}. The user should have realastic email,address and phone number.`,
          },
        },
      ],
    };
  }
);
async function createUser(user: {
  name: string;
  email: string;
  address: string;
  phone: string;
}) {
  const users = await import("./data/users.json", {
    with: { type: "json" },
  }).then((m) => m.default);
  const id = users.length + 1;

  users.push({ id, ...user });

  await fs.writeFile("./src/data/users.json", JSON.stringify(users, null, 2));
  return id;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
