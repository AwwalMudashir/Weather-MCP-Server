import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from "zod";

const server = new McpServer({
    name: "Weather Server",
    version: "1.0.0",
});

// The server manages all communication using the MCP protocol between clients
// (like VS Code) and your tools.


// Defining the first tool

// Tools are functions that AI agents can call.

server.tool(
    'get-weather',
    'Tool for getting the weather of a city',
    {
        city: z.string().describe("The name of the city to get the weather for")
    },
    async ({ city }) => {
        try {
            // fetching live data from the open meteo geocoding API
            const geocodeResponse = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
            );

            if (!geocodeResponse.ok) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `The weather service failed for "${city}". Please try again.`
                        }
                    ]
                };
            }

            const geocodeData = await geocodeResponse.json();

            if (!geocodeData.results || geocodeData.results.length === 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Sorry, I couldn't find a city named "${city}".`
                        }
                    ]
                };
            }

            const latitude = geocodeData.results[0].latitude;
            const longitude = geocodeData.results[0].longitude;

            const weatherResponse = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`
            );

            if (!weatherResponse.ok) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `The weather API failed for "${city}".`
                        }
                    ]
                };
            }

            const weatherData = await weatherResponse.json();
            const current = weatherData.current;

            const temp = current.temperature_2m;
            const feelsLike = current.apparent_temperature;
            const humidity = current.relative_humidity_2m;
            const wind = current.wind_speed_10m;
            const weatherCode = current.weather_code;
            const condition = getWeatherDescription(weatherCode);

            return {
                content: [
                    {
                        type: 'text',
                        text: `Current weather in ${city}: ${temp}°C, feels like ${feelsLike}°C, humidity ${humidity}%, wind ${wind} km/h, ${condition}.`
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Something went wrong while fetching weather for "${city}".`
                    }
                ]
            };
        }
    }
);

function getWeatherDescription(code: number) {
    const weatherMap: Record<number, string> = {
        0: "clear sky",
        1: "mainly clear",
        2: "partly cloudy",
        3: "overcast",
        45: "foggy",
        48: "depositing rime fog",
        51: "light drizzle",
        53: "moderate drizzle",
        55: "dense drizzle",
        61: "slight rain",
        63: "moderate rain",
        65: "heavy rain",
        71: "slight snow",
        73: "moderate snow",
        75: "heavy snow",
        80: "rain showers",
        81: "heavy rain showers",
        82: "violent rain showers",
        95: "thunderstorm",
    };

    return weatherMap[code] || "weather conditions available";
}

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