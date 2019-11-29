import { InputHints, MessageFactory } from 'botbuilder';
import {
    ConfirmPrompt,
    DialogTurnResult,
    TextPrompt,
    WaterfallDialog,
    WaterfallStepContext
} from 'botbuilder-dialogs';
import { OrderDetails } from './orderDetails';
import { CancelAndHelpDialog } from './cancelAndHelpDialog';

const CONFIRM_PROMPT = 'confirmPrompt';
const TEXT_PROMPT = 'textPrompt';
const WATERFALL_DIALOG = 'waterfallDialog';

export class OrderDialog extends CancelAndHelpDialog {
    constructor(id: string) {
        super(id || 'orderDialog');
        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new ConfirmPrompt(CONFIRM_PROMPT))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.foodStep.bind(this),
                this.beverageStep.bind(this),
                this.confirmStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    /**
     * If food type has not been provided, prompt for one.
     */
    private async foodStep(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
        const orderDetails = stepContext.options as OrderDetails;
        if (!orderDetails.food) {
            const messageText = 'What kind of food do you want to order?';
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        } else {
            return await stepContext.next(orderDetails.food);
        }
    }

    /**
     * If a beverage has not been provided, prompt for one.
     */
    private async beverageStep(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
        const orderDetails = stepContext.options as OrderDetails;
        // Capture the response to the previous step's prompt
        orderDetails.food = stepContext.result;
        if (!orderDetails.beverage) {
            const messageText = 'What do you want to drink?';
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        } else {
            return await stepContext.next(orderDetails.beverage);
        }
    }

    /**
     * Confirm the information the user has provided.
     */
    private async confirmStep(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
        const orderDetails = stepContext.options as OrderDetails;
        // Capture the results of the previous step
        orderDetails.beverage = stepContext.result;
        const messageText = `Please confirm the following order. Kind of pizza: ${ orderDetails.food } along with: ${ orderDetails.beverage }. Is this correct?`;
        const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        // Offer a YES/NO prompt.
        return await stepContext.prompt(CONFIRM_PROMPT, { prompt: msg });
    }

    /**
     * Complete the interaction and end the dialog.
     */
    private async finalStep(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
        if (stepContext.result === true) {
            const orderDetails = stepContext.options as OrderDetails;
            return await stepContext.endDialog(orderDetails);
        }
        return await stepContext.endDialog();
    }
}