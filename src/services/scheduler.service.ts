import cron, { type ScheduledTask } from "node-cron";
import { Keyword } from "../db/models/keyword.js";

class SchedulerService {
  private schedules: { [key: string]: ScheduledTask } = {};

  createSchedule(
    { cron: cronExpression, keyword: keywordName }: { keyword: string; cron: string },
    task: () => void
  ) {
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }


    if (this.schedules[keywordName]) {
      this.schedules[keywordName].stop();
    }

    const schedule = cron.schedule(cronExpression, task);
    this.schedules[keywordName] = schedule;
  }

  disableSchedule(keywordName: string) {
    const schedule = this.schedules[keywordName];
    if (!schedule) {
      return;
    }

    schedule.stop();
    delete this.schedules[keywordName];
  }


}

export const schedulerService = new SchedulerService();

