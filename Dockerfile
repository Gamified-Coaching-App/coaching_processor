# Use the official Node.js 20 image as a parent image
FROM node:20

# Set the working directory within the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json into the working directory
COPY package*.json ./

# Install any dependencies
RUN npm install

# Copy the rest of your application's code into the working directory
COPY src/ ./ 

# Make port 80 available outside this container
EXPOSE 80

# Define the command to run your app using CMD which defines your runtime
CMD ["npm", "start"]