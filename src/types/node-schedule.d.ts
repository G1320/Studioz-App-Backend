declare module 'node-schedule' {
    export interface Job {
      cancel: () => void;
    }
  
    export function scheduleJob(
      rule: string | Date | RecurrenceRule,
      callback: () => void
    ): Job;
  
    export class RecurrenceRule {
      constructor();
      month: number | number[];
      date: number | number[];
      dayOfWeek: number | number[];
      hour: number | number[];
      minute: number | number[];
      second: number | number[];
    }
  
    const schedule: {
      scheduleJob: typeof scheduleJob;
      Job: Job;
      RecurrenceRule: typeof RecurrenceRule;
    };
  
    export default schedule;
  }