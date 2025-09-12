import { EventEmitter } from 'events';

export class EventHandlers{
    private eventEmitter: EventEmitter;
    constructor(eventEmitter: EventEmitter) {
        this.eventEmitter = eventEmitter;
    }

    public registerRouteEventHandlers() {
        console.log('Events Fire Up')
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

    private announceRouteAccess(route: string) {
        console.log(`${route} was accessed`);
    }

    private upgradeSecurity(route: string) {
        console.log(`Locking all other routes: ${route}`);
    }
}
