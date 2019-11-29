import { config } from 'dotenv';
import * as path from 'path';
import * as restify from 'restify';

// Import required bot services. // See https://aka.ms/bot-services to learn more about the different parts of a bot.
import { BotFrameworkAdapter, ConversationState, MemoryStorage, UserState } from 'botbuilder';
import { LuisApplication } from 'botbuilder-ai';

// The bot and its main dialog.
import { DialogAndWelcomeBot } from './bots/welcomeBot';
import { MainDialog } from './dialogs/mainDialog';

// The bot's booking dialog
import { OrderDialog } from './dialogs/orderDialog';
const ORDER_DIALOG = 'orderDialog';

// The helper-class recognizer that calls LUIS
import { FoodOrderRecognizer } from './dialogs/foodOrderRecognizer';

// Note: Ensure you have a .env file and include LuisAppId, LuisAPIKey and LuisAPIHostName.
const ENV_FILE = path.join(__dirname, '..', '.env');
config({ path: ENV_FILE });

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about adapters.
const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppID,
    appPassword: process.env.MicrosoftAppPassword
});

// Catch-all for errors.
adapter.onTurnError = async (context, error) => {
    // This check writes out errors to console log
    // NOTE: In production environment, you should consider logging this to Azure application insights.
    console.error(`\n [onTurnError]: ${ error }`);
    // Send a message to the user
    await context.sendActivity(`Oops. Something went wrong!`);
    // Clear out state
    await conversationState.delete(context);
};

// Define a state store for your bot. See https://aka.ms/about-bot-state to learn more about using MemoryStorage.
// A bot requires a state store to persist the dialog and user state between messages.
let conversationState: ConversationState;
let userState: UserState;

// For local development, in-memory storage is used.
// CAUTION: The Memory Storage used here is for local bot debugging only. When the bot
// is restarted, anything stored in memory will be gone.
const memoryStorage = new MemoryStorage();
conversationState = new ConversationState(memoryStorage);
userState = new UserState(memoryStorage);

// If configured, pass in the FoodOrderRecognizer. (Defining it externally allows it to be mocked for tests)
let luisRecognizer;
const { LuisAppId, LuisAPIKey, LuisAPIHostName } = process.env;
const luisConfig: LuisApplication = { applicationId: LuisAppId, endpointKey: LuisAPIKey, endpoint: `https://${ LuisAPIHostName }` };
luisRecognizer = new FoodOrderRecognizer(luisConfig);

// Create the main dialog.
const orderDialog = new OrderDialog(ORDER_DIALOG);
const dialog = new MainDialog(luisRecognizer, orderDialog);
const bot = new DialogAndWelcomeBot(conversationState, userState, dialog);

// Create HTTP server
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, () => {
    console.log(`\n${ server.name } listening to ${ server.url }`);
    console.log(`\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator`);
    console.log(`\nTo test your bot, see: https://aka.ms/debug-with-emulator`);
});

// Listen for incoming activities and route them to your bot main dialog.
server.post('/api/messages', (req, res) => {
    // Route received a request to adapter for processing
    adapter.processActivity(req, res, async (turnContext) => {
        // route to bot activity handler.
        await bot.run(turnContext);
    });
});