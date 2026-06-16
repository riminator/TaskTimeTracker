import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import { meetingTools } from './tools/meeting-tools.js';
import { manualTools } from './tools/manual-tools.js';
import { importTools } from './tools/import-tools.js';
import { documentationResources } from './resources/documentation.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

/**
 * Teams Time Tracker MCP Server
 * Syncs Microsoft Teams meetings to Jira time tracking
 */
class TeamsTimeTrackerServer {
  constructor() {
    // Load server configuration
    this.config = this.loadConfig();
    
    // Initialize MCP server
    this.server = new Server(
      {
        name: this.config.server.name,
        version: this.config.server.version
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    );

    // Initialize registries
    this.tools = new Map();
    this.resources = new Map();
    this.prompts = new Map();

    // Setup handlers and register tools/resources
    this.setupHandlers();
    this.registerTools();
    this.registerResources();
    this.registerPrompts();

    logger.info('Teams Time Tracker MCP Server initialized', {
      name: this.config.server.name,
      version: this.config.server.version
    });
  }

  /**
   * Load server configuration
   */
  loadConfig() {
    try {
      const configPath = path.join(__dirname, '../config/server-config.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      logger.warn('Failed to load server config, using defaults', { error: error.message });
      return {
        server: {
          name: 'teams-timetracker-mcp',
          version: '1.0.0',
          description: 'MCP server for syncing Teams meetings to time tracking'
        },
        capabilities: {
          tools: true,
          resources: true,
          prompts: true
        },
        security: {
          requireApproval: true,
          auditLog: true,
          dryRunDefault: true
        }
      };
    }
  }

  /**
   * Setup MCP request handlers
   */
  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.info('Handling ListTools request');
      
      return {
        tools: Array.from(this.tools.values()).map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      };
    });

    // Execute a tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      logger.info('Handling CallTool request', { toolName: name });
      logger.audit('tool_called', { toolName: name, arguments: args });

      const tool = this.tools.get(name);
      
      if (!tool) {
        const error = `Unknown tool: ${name}`;
        logger.error(error);
        throw new Error(error);
      }

      try {
        const result = await tool.execute(args || {});
        
        logger.info('Tool execution completed', { 
          toolName: name, 
          success: result.success 
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        logger.error('Tool execution failed', { 
          toolName: name, 
          error: error.message,
          stack: error.stack
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message,
                toolName: name
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      logger.info('Handling ListResources request');
      
      return {
        resources: Array.from(this.resources.values()).map(resource => ({
          uri: resource.uri,
          name: resource.name,
          description: resource.description,
          mimeType: resource.mimeType
        }))
      };
    });

    // Read a resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      logger.info('Handling ReadResource request', { uri });

      const resource = this.resources.get(uri);
      
      if (!resource) {
        const error = `Unknown resource: ${uri}`;
        logger.error(error);
        throw new Error(error);
      }

      try {
        const content = await resource.read();
        
        return {
          contents: [
            {
              uri: resource.uri,
              mimeType: resource.mimeType,
              text: content
            }
          ]
        };
      } catch (error) {
        logger.error('Resource read failed', { 
          uri, 
          error: error.message 
        });
        throw error;
      }
    });

    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      logger.info('Handling ListPrompts request');
      
      return {
        prompts: Array.from(this.prompts.values()).map(prompt => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments
        }))
      };
    });

    // Get a prompt
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      logger.info('Handling GetPrompt request', { promptName: name });

      const prompt = this.prompts.get(name);
      
      if (!prompt) {
        const error = `Unknown prompt: ${name}`;
        logger.error(error);
        throw new Error(error);
      }

      try {
        const messages = await prompt.generate(args || {});
        
        return {
          description: prompt.description,
          messages
        };
      } catch (error) {
        logger.error('Prompt generation failed', { 
          promptName: name, 
          error: error.message 
        });
        throw error;
      }
    });
  }

  /**
   * Register all tools
   */
  registerTools() {
    logger.info('Registering tools');
    
    // Register Teams integration tools
    for (const tool of meetingTools) {
      this.tools.set(tool.name, tool);
      logger.info('Registered tool', { name: tool.name });
    }
    
    // Register manual/hybrid tools
    for (const tool of manualTools) {
      this.tools.set(tool.name, tool);
      logger.info('Registered tool', { name: tool.name });
    }
    
    // Register import tools
    for (const tool of importTools) {
      this.tools.set(tool.name, tool);
      logger.info('Registered tool', { name: tool.name });
    }
  }

  /**
   * Register all resources
   */
  registerResources() {
    logger.info('Registering resources');
    
    for (const resource of documentationResources) {
      this.resources.set(resource.uri, resource);
      logger.info('Registered resource', { uri: resource.uri });
    }
  }

  /**
   * Register prompts
   */
  registerPrompts() {
    logger.info('Registering prompts');

    // Daily timesheet review prompt
    this.prompts.set('review-daily-timesheet', {
      name: 'review-daily-timesheet',
      description: 'Generate a prompt to review and approve daily meeting time entries',
      arguments: [
        {
          name: 'date',
          description: 'Date to review (ISO 8601 format)',
          required: true
        },
        {
          name: 'userEmail',
          description: 'User email address',
          required: true
        }
      ],
      generate: async (args) => {
        const date = args.date || new Date().toISOString().split('T')[0];
        const userEmail = args.userEmail || process.env.DEFAULT_USER_EMAIL;

        return [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please review my meetings for ${date} and suggest time tracking entries.

User: ${userEmail}
Date: ${date}

Steps:
1. Use list_recent_meetings to fetch my meetings for this date
2. Use suggest_time_entries to classify and generate suggestions
3. Present the suggestions grouped by project
4. Highlight any low-confidence classifications that need review
5. Show excluded meetings and reasons
6. Ask for my approval before creating entries

Please start by fetching my meetings.`
            }
          }
        ];
      }
    });

    // Weekly summary prompt
    this.prompts.set('weekly-summary', {
      name: 'weekly-summary',
      description: 'Generate a prompt for weekly meeting time summary',
      arguments: [
        {
          name: 'userEmail',
          description: 'User email address',
          required: true
        }
      ],
      generate: async (args) => {
        const userEmail = args.userEmail || process.env.DEFAULT_USER_EMAIL;
        const today = new Date();
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        return [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please provide a summary of my meetings for this week.

User: ${userEmail}
Week: ${startOfWeek.toISOString().split('T')[0]} to ${endOfWeek.toISOString().split('T')[0]}

Please:
1. Fetch all meetings for the week
2. Classify and analyze them
3. Show breakdown by project
4. Calculate total meeting time
5. Identify any gaps or issues
6. Suggest which entries still need to be logged

Start by fetching the meetings.`
            }
          }
        ];
      }
    });

    logger.info('Registered prompts', { count: this.prompts.size });
  }

  /**
   * Start the MCP server
   */
  async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logger.info('Teams Time Tracker MCP Server started successfully');
      logger.info('Server is ready to accept requests via stdio');
    } catch (error) {
      logger.error('Failed to start server', { error: error.message });
      throw error;
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    const server = new TeamsTimeTrackerServer();
    await server.start();
  } catch (error) {
    logger.error('Fatal error during server startup', { 
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default TeamsTimeTrackerServer;

// Made with Bob
