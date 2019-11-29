import { OrderDetails } from './orderDetails';
import { InputHints, MessageFactory, StatePropertyAccessor, TurnContext } from 'botbuilder';
import { LuisRecognizer } from 'botbuilder-ai';
import {
    ComponentDialog,
    DialogSet,
    DialogState,
    DialogTurnResult,
    DialogTurnStatus,
    TextPrompt,
    WaterfallDialog,
    WaterfallStepContext
} from 'botbuilder-dialogs';
import { OrderDialog } from './orderDialog';
import { FoodOrderRecognizer } from './foodOrderRecognizer';

const MAIN_WATERFALL_DIALOG = 'mainWaterfallDialog';

export class MainDialog extends ComponentDialog {
    private luisRecognizer: FoodOrderRecognizer;

    constructor(luisRecognizer: FoodOrderRecognizer, orderDialog: OrderDialog) {
        super('MainDialog');
        if (!luisRecognizer) throw new Error('[MainDialog]: Missing parameter \'luisRecognizer\' is required');
        this.luisRecognizer = luisRecognizer;
        if (!orderDialog) throw new Error('[MainDialog]: Missing parameter \'orderDialog\' is required');
        // Define the main dialog and its related components.
        // This is a sample "order food" dialog.
        this.addDialog(new TextPrompt('TextPrompt'))
            .addDialog(orderDialog)
            .addDialog(new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
                this.introStep.bind(this),
                this.actStep.bind(this),
                this.finalStep.bind(this)
            ]));
        this.initialDialogId = MAIN_WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a DialogContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {TurnContext} context
     */
    public async run(context: TurnContext, accessor: StatePropertyAccessor<DialogState>) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);
        const dialogContext = await dialogSet.createContext(context);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    /**
     * First step in the waterfall dialog. Prompts the user for a command.
     * Currently, this expects a order request, like "i want to order a salami pizza and a coke"
     */
    private async introStep(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
        if (!this.luisRecognizer.isConfigured) {
            const luisConfigMsg = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
            await stepContext.context.sendActivity(luisConfigMsg, null, InputHints.IgnoringInput);
            return await stepContext.next();
        }
        const messageText = (stepContext.options as any).restartMsg ? (stepContext.options as any).restartMsg : 'What can I help you with today?';
        const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt('TextPrompt', { prompt: promptMessage });
    }

    /**
     * Second step in the waterall. This will use LUIS to attempt to extract the type of food and beverage to order.
     * Then, it hands off to the orderDialog child dialog to collect any remaining details.
     */
    private async actStep(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
        const orderDetails = new OrderDetails();
        if (!this.luisRecognizer.isConfigured) {
            // LUIS is not configured, we just run the orderDialog path.
            console.log('LUIS not configured');
            return await stepContext.beginDialog('orderDialog', orderDetails);
        }
        // Call LUIS and gather any potential order details. (Note the TurnContext has the response to the prompt)
        const luisResult = await this.luisRecognizer.executeLuisQuery(stepContext.context);
        switch (LuisRecognizer.topIntent(luisResult)) {
        case 'OrderFood':
            // Extract the values for the composite entities from the LUIS result.
            const foodEntity = this.luisRecognizer.getfoodEntities(luisResult);
            const beverageEntity = this.luisRecognizer.getBeverageEntities(luisResult);
            // Initialize orderDetails with any entities we may have found in the response.
            orderDetails.food = foodEntity.food;
            orderDetails.beverage = beverageEntity.beverage;
            console.log('LUIS extracted these order details:', JSON.stringify(orderDetails));
            // Run the orderDialog passing in whatever details we have from the LUIS call, it will fill out the remainder.
            return await stepContext.beginDialog('orderDialog', orderDetails);
        case 'ShowOrders':
            // Implement a call to get the orders for the user (e.g. API call or whatever)
            await stepContext.context.sendActivity("Here are your previous orders:");
            await stepContext.context.sendActivity("Pizza Salami & Coke Zero - 03/09/2019");
            await stepContext.context.sendActivity("Pizza Margherita & Apple juice - 09/10/2019");
            break;
        case 'Help':
            console.log('Help intent triggered');
            await stepContext.context.sendActivity("What can I do for you?");
            break;
        default:
            // Catch all for unhandled intents
            const didntUnderstandMessageText = `Sorry, I didn't get that. Please try asking in a different way (intent was ${ LuisRecognizer.topIntent(luisResult) })`;
            await stepContext.context.sendActivity(didntUnderstandMessageText, didntUnderstandMessageText, InputHints.IgnoringInput);
        }
        return await stepContext.next();
    }

    /**
     * This is the final step in the main waterfall dialog.
     * It wraps up the sample "order food" interaction with a simple confirmation.
     */
    private async finalStep(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
        // If the child dialog ("orderDialog") was cancelled or the user failed to confirm, the Result here will be null.
        if (stepContext.result) {
            const result = stepContext.result as OrderDetails;
            // Now we have all the order details.
            // This is where calls to the order service or database would go.
            const msg = `I have added your order: ${ result.food } including ${ result.beverage } to our system.`;
            await stepContext.context.sendActivity(msg);
        }
        // Restart the main dialog waterfall with a different message the second time around
        return await stepContext.replaceDialog(this.initialDialogId, { restartMsg: 'What else can I do for you?' });
    }
}