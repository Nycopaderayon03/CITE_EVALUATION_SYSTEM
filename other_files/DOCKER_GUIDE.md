# 🐳 Docker Step-by-Step Guide

This guide explains how to manage, start, stop, and rebuild the fully Dockerized version of the College Evaluation System.

## 1. Start the System
To start the system in the background, open your terminal in the project folder and run:
```bash
docker-compose up -d
```
*Note: We previously configured the web app to run on port **8080** and database on **3307** to avoid colliding with your local `npm run dev` and MySQL server.*
- **App URL:** [http://localhost:8080](http://localhost:8080)

## 2. Stop the System
When you want to shut down the containers, run:
```bash
docker-compose down
```
*This safely stops and removes the running containers, but leaves your database data completely intact (stored in the Docker volume).*

## 3. Rebuild (When You Change Code)
If you make changes to your Next.js application code or update packages in `package.json`, you must rebuild the image so the changes take effect. Run:
```bash
docker-compose up --build -d
```

## 4. Run Database Migrations or Setup
If the database needs to be re-initialized or migrated, you can execute the command directly inside the running Next.js container:
```bash
# To run migrations:
docker-compose exec web npm run db:migrate

# To seed initial data (Admin accounts, courses, etc.):
docker-compose exec web npm run db:seed
```

## 5. Check the Logs
If something goes wrong (e.g., you get a 500 error or the container crashes), you can check the live logs:
```bash
# View logs for both the App and the Database:
docker-compose logs -f

# View logs strictly for the Next.js Web App:
docker-compose logs -f web

# View logs strictly for the MySQL Database:
docker-compose logs -f db
```
*(Press `Ctrl+C` to stop watching the logs)*

## 6. Full Reset (Warning: Destructive)
If you want to completely destroy everything and start fresh, including wiping the database data:
```bash
docker-compose down -v
```
*(After this, you will need to re-run migrations and seeding scripts)*
