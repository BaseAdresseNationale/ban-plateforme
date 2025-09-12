import { EventEmitter } from 'events';
export class EventHandlers {
    eventEmitter;
    constructor(eventEmitter) {
        this.eventEmitter = eventEmitter;
    }
    registerRouteEventHandlers() {
        console.log('Events Fire Up');
        this.eventEmitter.on('routeAccess', (route) => {
            try {
                this.announceRouteAccess(route);
                this.upgradeSecurity(route);
            }
            catch (error) {
                console.error('Error handling routeAccess event:', error);
            }
            console.log('Route was accessed');
        });
    }
    announceRouteAccess(route) {
        console.log(`${route} was accessed`);
    }
    upgradeSecurity(route) {
        console.log(`Locking all other routes: ${route}`);
    }
}
//# sourceMappingURL=events.js.map