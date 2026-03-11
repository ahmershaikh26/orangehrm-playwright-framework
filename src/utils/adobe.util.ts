declare global {
    interface Window {
        adobe?: any;
    }
}

export class AdobeUtil {
    static verifyAdobeTags(tagName: string, expectedValue: string): boolean {
        const actualValue = window.adobe && window.adobe[tagName];
        return actualValue === expectedValue;
    }

    static getAdobeTagValue(tagName: string): any {
        return window.adobe ? window.adobe[tagName] : null;
    }

    static logAdobeTags(): void {
        if (window.adobe) {
            console.log('Adobe Tags:', window.adobe);
        } else {
            console.warn('Adobe Tags are not available.');
        }
    }
}