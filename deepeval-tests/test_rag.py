import os
import pytest
from deepeval import assert_test
from deepeval.test_case import LLMTestCase
from deepeval.metrics import FaithfulnessMetric
from deepeval.models import GeminiModel

API_KEY_GEMINI = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
# Usamos Gemini como el modelo juez
EVAL_MODEL = GeminiModel(model="gemini-1.5-pro", api_key=API_KEY_GEMINI)

def test_manual_operaciones_faithfulness():
    # Contexto real del negocio cargado en el sistema
    contexto_manual = [
        "Parkontrol no tiene un control o restricción para las matrículas más allá de la longitud",
        "Cualquier combinación de caracteres para la matrícula entre 2 y 10 caracteres puede ser registrada y buscada"
    ]
    
    # Simulación de una respuesta errónea (Alucinación) para verificar que el test la detecte
    test_case = LLMTestCase(
        input="¿Puedo registrar un vehículo de 5 letras y 3 números?",
        actual_output="Sí, por supuesto. Se encuentra dentro de los límites de longitud",
        retrieval_context=contexto_manual
    )
    
    # La métrica evalúa si la respuesta se contradice o sale del contexto proveído
    metric = FaithfulnessMetric(threshold=0.7, model=EVAL_MODEL)
    
    # NOTA: Este test está diseñado para FALLAR en la consola, demostrando que DeepEval
    # efectivamente intercepta cuando la IA de tu aplicación inventa información.
    assert_test(test_case, [metric])