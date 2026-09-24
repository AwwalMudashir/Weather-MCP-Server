# MCP Weather Server

This project is a simple Model Context Protocol (MCP) server that exposes a `get-weather` tool to AI clients. It lets a client ask for weather data for a city and then fetches live weather information from the Open-Meteo API.

The project has two versions:

- `main.ts`: the original server implementation
- `cleaner-main.ts`: a cleaner version that formats the response into a plain-text summary for easier AI/client consumption

---

## What this project does

The server creates an MCP tool called `get-weather`.

When a client calls it with a city name like:

```json
{ "city": "Ikeja" }
```

it:

1. Validates the input using Zod
2. Calls the Open-Meteo geocoding API to find the city
3. Extracts the city’s latitude and longitude
4. Calls the Open-Meteo forecast API for live weather
5. Returns the result in the MCP response format

---

## Main file: `main.ts`

### 1. Imports

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from "zod";
```

These imports do three main jobs:

- `McpServer`: creates the MCP server and defines tools
- `StdioServerTransport`: lets the server communicate over standard input/output, which is the normal way for local MCP servers
- `z`: the Zod library used for validating tool inputs

### 2. Server creation

```ts
const server = new McpServer({
    name: "Weather Server",
    version: "1.0.0",
});
```

This creates the MCP server instance with a name and version. This helps AI clients identify the tool provider.

### 3. Tool definition

```ts
server.tool(
    'get-weather',
    'Tool for getting the weather of a city',
    {
        city: z.string().describe("The name of the city to get the weather for")
    },
    async ({city}) => {
```

This registers a tool named `get-weather`.

Important parts:

- tool name: `get-weather`
- human-readable description: explains what the tool is for
- schema: `city: z.string()` ensures the input is a string
- handler: runs when the tool is called

The `city` field is validated by Zod before the function executes.

### 4. Geocoding API call

```ts
const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=10&language=en&format=json`)
const data = await response.json()
```

This sends a request to Open-Meteo’s geocoding API to search for the city name. The API returns matching locations with data like:

- name
- latitude
- longitude
- country
- timezone

### 5. City not found check

```ts
if (data.results.length === 0){
    return {
        content: [
            {
                type: 'text',
                text: `Sorry I couldn't find the weather in ${city}, Does it even exist Nigga ?`
            }
        ]
    }
}
```

This handles the case where no city matches the user input. Instead of crashing, the tool returns a friendly error message in MCP format.

### 6. Getting latitude and longitude

```ts
const latitude = data.results[0].latitude
const longitude = data.results[0].longitude
```

Once the city is found, the first result is used to get its coordinates. These are needed for the actual weather request.

### 7. Weather API call

```ts
const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,dew_point_2m,rain,showers,snowfall,snow_depth,precipitation,precipitation_probability,evapotranspiration,vapour_pressure_deficit,wind_speed_180m,temperature_120m`)
const weatherData = await weatherResponse.json()
```

This fetches the detailed weather forecast for the city’s coordinates from Open-Meteo.

### 8. Returning the response

```ts
return {
    content: [
        {
            type: 'text',
            text: JSON.stringify(weatherData, null, 2)
        }
    ]
}
```

The server returns the data in the MCP content format. In its original form, it dumps the raw JSON weather payload directly as text.

### 9. MCP transport setup

```ts
const transport = new StdioServerTransport();
server.connect(transport);
```

This connects the server to the standard input/output transport so AI clients can communicate with it.

---

## Why Zod is used here

Zod is used to validate the input shape before the tool runs.

```ts
city: z.string().describe("The name of the city to get the weather for")
```

This means the tool will reject bad input such as:

- missing `city`
- non-string values
- invalid request shapes

This is important for MCP tools because tool calls may come from different clients and user inputs can be unpredictable.

---

## Cleaner version: `cleaner-main.ts`

The cleaner version keeps the same structure, but improves how the output is returned.

### Main upgrade

Instead of returning the raw Open-Meteo JSON blob, it formats a plain-language weather summary such as:

```text
Current weather in Ikeja: 28.9°C, feels like 33.8°C, humidity 71%, wind 8.9 km/h, light drizzle.
```

This is much easier for AI clients and end users to read.

### How it improves the original code

#### 1. Better geocoding request

```ts
`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
```

This uses `encodeURIComponent(city)` to safely handle names with spaces and special characters.

#### 2. Better error handling

The cleaner version checks:

- `geocodeResponse.ok`
- whether a city was actually found
- `weatherResponse.ok`
- JSON parsing fallback with `try/catch`

This prevents the server from crashing on bad API responses.

#### 3. Cleaner output formatting

Instead of returning raw JSON, it extracts useful fields:

```ts
const temp = current.temperature_2m;
const feelsLike = current.apparent_temperature;
const humidity = current.relative_humidity_2m;
const wind = current.wind_speed_10m;
const weatherCode = current.weather_code;
const condition = getWeatherDescription(weatherCode);
```

Then composes a readable message.

#### 4. Weather-code mapping

```ts
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
```

This converts numeric weather codes from Open-Meteo into readable descriptions like “light drizzle” or “clear sky”.

---

## Major code blocks and their purpose

### `McpServer`
Creates the MCP server object that defines tools and exposes them to clients.

### `server.tool(...)`
Registers a tool so the client can call it by name.

### Zod schema
Defines what input the tool expects and validates it before execution.

### `fetch(...)` calls
Hit external APIs to get city coordinates and forecast data.

### `if (!response.ok)` checks
Catch API failures and return a clean error message.

### `return { content: [{ type: 'text', text: ... }] }`
This is the required MCP response structure for text output.

### `StdioServerTransport`
Enables the server to communicate over standard I/O for local MCP usage.

---

## Example usage

A client can call the tool with:

```json
{ "city": "Ikeja" }
```

And the server may respond with:

```text
Current weather in Ikeja: 28.9°C, feels like 33.8°C, humidity 71%, wind 8.9 km/h, light drizzle.
```

---

## How to run the project

From the project folder:

```bash
npx tsx main.ts
```

or for the cleaned version:

```bash
npx tsx cleaner-main.ts
```

---

## Summary

This project is a simple example of building an MCP weather tool using:

- TypeScript
- Zod validation
- Open-Meteo APIs
- MCP server/tool architecture

The original `main.ts` is a working starter example, while `cleaner-main.ts` improves the developer experience by producing a more readable result for human and AI clients.
