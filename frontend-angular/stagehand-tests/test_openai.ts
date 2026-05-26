import { Stagehand } from "@browserbasehq/stagehand";
import { BROWSER_OPTIONS, MODELS } from "../src/config/stagehand.config";

async function testOpenAI() {
  const stagehand = new Stagehand({
    env: "LOCAL",
    apiKey: process.env['OPENAI_API_KEY'],
    model: MODELS.gpt,
    localBrowserLaunchOptions: BROWSER_OPTIONS
  });

  await stagehand.init();
  const page = stagehand.context.pages()[0];

  console.log("Iniciando navegador guiado por ChatGPT...");
  await page.goto("http://localhost:4200/login");

  // Stagehand analiza el DOM y deduce cuáles son los campos de login sin usar selectores CSS
  await stagehand.act("Fill in the username field with 'd@ex.com'");
  await stagehand.act("Fill in the password field with '123456'");
  await stagehand.act("Click on the login or submit button");

  // Esperamos que Angular cargue el dashboard
  await page.waitForTimeout(3000);

  // Flujo de registro de vehiculo ya registrado
  await stagehand.act("Find the 'Vehículos' section in the sidebar and click it");
  await stagehand.act("Type 'ABC123' in Placa field in Registrar nuevo vehículo form");
  await stagehand.act("Make sure that ID Tipo Vehículo field is '1' in Registrar nuevo vehículo form");
  await stagehand.act("Click the registration confirmation button");

  // Esperamos que Angular cargue el output
  await page.waitForTimeout(1000);
  await stagehand.act("Check if a error message 'Ya existe un vehiculo con la placa ingresada' appeared ");

  console.log("Flujo completado por el agente de ChatGPT.");
  await stagehand.close();
}

testOpenAI();