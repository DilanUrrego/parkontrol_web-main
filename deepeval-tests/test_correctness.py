import os
import pytest
from deepeval import assert_test
from deepeval.test_case import LLMTestCase
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams
from deepeval.models import GeminiModel

API_KEY_GEMINI = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
# Usamos Gemini como el modelo juez
EVAL_MODEL = GeminiModel(model="gemini-1.5-pro", api_key=API_KEY_GEMINI)

def test_calculo_tarifa_correctness():
    # Caso de uso: El operario o usuario consulta el costo acumulado de un carro
    test_case = LLMTestCase(
        input="Buscar qué tipo de vehículo está registrado con la placa 'ABC123'",
        actual_output="1	ABC123	AUTOMOVIL",
        expected_output="El vehículo con placa 'ABC123' es un automóvil"
    )
    
    # Threshold de 0.7 significa que debe ser al menos 70% semánticamente correcto
    metric = GEval(name="Correctness", evaluation_params=[
            LLMTestCaseParams.INPUT, 
            LLMTestCaseParams.ACTUAL_OUTPUT, 
            LLMTestCaseParams.EXPECTED_OUTPUT
        ], criteria="Determine whether the actual output is factually correct, complete, and aligns with the expected output (ground truth) without missing critical business values.", threshold=0.7, model=EVAL_MODEL)
    assert_test(test_case, [metric])