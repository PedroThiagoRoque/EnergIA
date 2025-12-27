const cron = require('node-cron');

class CronManager {
    constructor() {
        this.jobs = new Map();
    }

    register(name, schedule, handler) {
        if (this.jobs.has(name)) {
            console.warn(`[CronManager] Job ${name} already registered. Overwriting.`);
            this.jobs.get(name).task.stop();
        }

        const task = cron.schedule(schedule, handler, {
            scheduled: false // Don't start immediately upon creation
        });

        this.jobs.set(name, {
            name,
            schedule,
            handler,
            task,
            lastRun: null,
            status: 'STOPPED'
        });

        console.log(`[CronManager] Registered job: ${name} with schedule: ${schedule}`);
    }

    startAll() {
        this.jobs.forEach((job) => {
            job.task.start();
            job.status = 'RUNNING';
            console.log(`[CronManager] Started job: ${job.name}`);
        });
    }

    start(name) {
        const job = this.jobs.get(name);
        if (job) {
            job.task.start();
            job.status = 'RUNNING';
            console.log(`[CronManager] Started job: ${name}`);
        }
    }

    stop(name) {
        const job = this.jobs.get(name);
        if (job) {
            job.task.stop();
            job.status = 'STOPPED';
            console.log(`[CronManager] Stopped job: ${name}`);
        }
    }

    async runJob(name) {
        const job = this.jobs.get(name);
        if (!job) {
            throw new Error(`Job ${name} not found`);
        }
        console.log(`[CronManager] Manually triggering job: ${name}`);
        job.lastRun = new Date();
        try {
            await job.handler(); // Execute handler immediately
        } catch (err) {
            console.error(`[CronManager] Error running job ${name}:`, err);
            throw err;
        }
    }

    updateSchedule(name, newSchedule) {
        const job = this.jobs.get(name);
        if (!job) {
            throw new Error(`Job ${name} not found`);
        }

        if (!cron.validate(newSchedule)) {
            throw new Error(`Invalid cron expression: ${newSchedule}`);
        }

        job.task.stop();

        const newTask = cron.schedule(newSchedule, job.handler, {
            scheduled: true // Auto start if it was running? Let's assume we start it
        });

        // Update job record
        job.schedule = newSchedule;
        job.task = newTask;
        job.status = 'RUNNING'; // Assuming we want it running after update

        console.log(`[CronManager] Updated schedule for job: ${name} to ${newSchedule}`);
    }

    getAllJobs() {
        return Array.from(this.jobs.values()).map(job => ({
            name: job.name,
            schedule: job.schedule,
            status: job.status,
            lastRun: job.lastRun
        }));
    }
}

// Singleton instance
const cronManager = new CronManager();
module.exports = cronManager;
