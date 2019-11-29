import { RecognizerResult, TurnContext } from 'botbuilder';
import { LuisApplication, LuisRecognizer } from 'botbuilder-ai';

export class FoodOrderRecognizer {
    private recognizer: LuisRecognizer;
    constructor(config: LuisApplication) {
        const luisIsConfigured = config && config.applicationId && config.endpoint && config.endpointKey;
        if (luisIsConfigured) {
            this.recognizer = new LuisRecognizer(config, {}, true);
        }
    }

    public get isConfigured(): boolean {
        return (this.recognizer !== undefined);
    }

    /**
     * Returns an object with preformatted LUIS results for the bot's dialogs to consume.
     * @param {TurnContext} context
     */
    public async executeLuisQuery(context: TurnContext): Promise<RecognizerResult> {
        return this.recognizer.recognize(context);
    }

    public getfoodEntities(result) {
        let foodValue;
        if (result.entities.$instance.Food) {
            foodValue = result.entities.$instance.Food[0].text;
        }
        return { food: foodValue};
    }

    public getBeverageEntities(result) {
        let beverageValue;
        if (result.entities.$instance.Beverage) {
            beverageValue = result.entities.$instance.Beverage[0].text;
        }
        return { beverage: beverageValue};
    }
}