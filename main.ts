import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from "zod";


const server = new McpServer({
    name: "Weather Server",
    version: "1.0.0",
});

// The server manages all communication using the MCP protocol between clients
// (like VS Code) and your tools.


// Defining the first tool

// Tools are functions that AI agents can call.

// the tool method is deprecated, but it is still supported for now. The new way to define tools is using the `server.registerTool` method.
server.tool(
    'get-weather',
    'Tool for getting the weather of a city',
    {
        city: z.string().describe("The name of the city to get the weather for")
    },
    async ({city}) => {

        // fetching the lat and long data from the open meteo geocoding API
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=10&language=en&format=json`)

        if (!response.ok) {
            return {
                content: [
                {
                    type: "text",
                    text: `Yoo, The location service failed for "${city}". Try another city.`
                }
                ]
            };
        }

        const data = await response.json()

        if (!data?.results?.length){
            return {
                content: [
                    {
                        type: 'text',
                        text: `Sorry I couldn't find the lat and long of your so called city, ${city}, Does it even exist ?`
                    }
                ]
            }
        }

        // using the lat and long from the geocode response to get the actual weather response
        const latitude = data.results[0].latitude
        const longitude = data.results[0].longitude

        const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,dew_point_2m,rain,showers,snowfall,snow_depth,precipitation,precipitation_probability,evapotranspiration,vapour_pressure_deficit,wind_speed_180m,temperature_120m`)

        if (!weatherResponse.ok) {
            return {
                content: [
                {
                    type: "text",
                    text: `The weather API failed for "${city}". Try again in a moment.`
                }
                ]
            };
        }


        let weatherData;

        try{
            weatherData = await weatherResponse.json()
        } catch{
              return {
                content: [
                {
                    type: "text",
                    text: `Brochacho I got a bad response from the weather service for "${city}".`
                }
                ]
            };
        }

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(weatherData, null, 2)
                }
            ]
        }
    }
)


// How it works

// - AI agent sees: "Tool to get the weather of a city
// - AI agent calls it with: { city: "Paris" }
// - Zod validates the input
// - Function returns the weather in the city



// Now we setup how our server communicates with AI clients
const transport = new StdioServerTransport();
server.connect(transport);


// Before adding real weather data, let's test our server using the MCP Inspector, a web-based
// debugging tool for MCP servers.

// Launch the Inspector using: npx @modelcontextprotocol/inspector npx -y tsx main.ts


// To register the server in VS Code:

// 1. Open the VS Code Command Palette (Cmd/Ctrl + Shift + P ).
// 2. Type "MCP: Add Server".
// 3. Choose "Local server using stdio".
// 4. Enter the command: npx -y tsx main.ts
// 5. Give it a name like my-weather-server
// 6. Choose local setup and click "Add Server".

