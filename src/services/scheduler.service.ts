import cron from "node-cron";

export function startScheduler() {
    
    const schedule = "0 * * * *";
    cron.schedule(schedule, () => {
         
    })
}