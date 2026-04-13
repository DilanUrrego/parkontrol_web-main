import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VistasService } from './vistas.service';
import { HistorialReservasView } from './entities/historial-reservas.view';
import { OcupacionParqueaderoView } from './entities/ocupacion-parqueadero.view';
import { FacturacionCompletaView } from './entities/facturacion-completa.view';
import { IngresosPorParqueaderoMensualView } from './entities/ingresos-parqueadero-mensual.view';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../../.env' });

describe('VistasService (Integración Real)', () => {
  let service: VistasService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'oracle',
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
          sid: process.env.DB_SID,
          entities: [
            HistorialReservasView, 
            OcupacionParqueaderoView, 
            FacturacionCompletaView, 
            IngresosPorParqueaderoMensualView
          ],
          logging: true,
          synchronize: true
        }),
        TypeOrmModule.forFeature([
        HistorialReservasView, 
        OcupacionParqueaderoView, 
        FacturacionCompletaView, 
        IngresosPorParqueaderoMensualView
        ]),
      ],
      providers: [VistasService],
    }).compile();

    service = module.get<VistasService>(VistasService);
  }, 20000);

  // TEST 1: HISTORIAL POR EMPRESA
  it('debería retornar el historial de reservas y transformar las llaves a camelCase', async () => {
    // ID existente en la DB
    const idEmpresaExistente = 1; 

    // Llamamos al historial
    const resultado = await service.getHistorialByEmpresa(idEmpresaExistente);

    // Validaciones de Caja Blanca
    console.log('Primer registro del historial:', resultado[0]);
    
    expect(Array.isArray(resultado)).toBe(true);
    
    if (resultado.length > 0) {
      // Verificamos que transformKeys hizo su trabajo (camelCase)
      // Si en Oracle es ID_RESERVA, aquí debe ser idReserva
      const primerRegistro = resultado[0];
      const llaves = Object.keys(primerRegistro);
      
      // Buscamos que no haya guiones bajos en las llaves
      const tieneGuionesBajos = llaves.some(key => key.includes('_'));
      expect(tieneGuionesBajos).toBe(false); 
      
      expect(primerRegistro).toHaveProperty('idCelda');
    }
  });

  // TEST 2: CAMINO ALTERNATIVO (EMPRESA SIN DATOS)
  it('debería retornar un arreglo vacío para una empresa que no existe', async () => {
    const idFalso = 999999;
    const resultado = await service.getHistorialByEmpresa(idFalso);
    
    expect(resultado).toEqual([]);
  });

  afterAll(async () => {
    if (module) await module.close();
  });
});



// ─────────────────────────────────────────────────────────────────────────────
// Fábricas de datos de prueba
// Los datos simulan exactamente lo que Oracle devuelve: MAYÚSCULAS_CON_GUION
// ─────────────────────────────────────────────────────────────────────────────
const mockFilaOracleHistorial = (overrides: Record<string, any> = {}) => ({
  ID_RESERVA:       1,
  ID_CELDA:         10,
  PLACA:            'ABC123',
  FECHA_INICIO:     new Date('2025-01-01T08:00:00'),
  FECHA_FIN:        new Date('2025-01-01T10:00:00'),
  ESTADO_RESERVA:   'FINALIZADA',
  NOMBRE_CLIENTE:   'Juan Pérez',
  NUMERO_DOCUMENTO: '1234567890',
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// Mock del DataSource (único punto de entrada a la BD en este servicio)
// ─────────────────────────────────────────────────────────────────────────────
const mockDataSource = () => ({
  query: jest.fn(),
});

const mockRepository = () => ({
  find:    jest.fn(),
  findOne: jest.fn(),
});

// ─────────────────────────────────────────────────────────────────────────────
describe('VistasService - HU-36: Historial de Reservas (Caja Blanca)', () => {
  let service: VistasService;
  let dataSource: ReturnType<typeof mockDataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VistasService,
        { provide: getRepositoryToken(OcupacionParqueaderoView),         useFactory: mockRepository },
        { provide: getRepositoryToken(HistorialReservasView),            useFactory: mockRepository },
        { provide: getRepositoryToken(FacturacionCompletaView),          useFactory: mockRepository },
        { provide: getRepositoryToken(IngresosPorParqueaderoMensualView),useFactory: mockRepository },
        { provide: getDataSourceToken(),                                  useFactory: mockDataSource },
      ],
    }).compile();

    service    = module.get<VistasService>(VistasService);
    dataSource = module.get(getDataSourceToken());
  });

  afterEach(() => jest.clearAllMocks());

  // ══════════════════════════════════════════════════════════════════════════
  // getHistorialByEmpresa()
  // Caminos: idEmpresa === null → query sin filtro | idEmpresa !== null → query con JOIN
  // ══════════════════════════════════════════════════════════════════════════
  describe('getHistorialByEmpresa()', () => {

    it('Camino 1: Debería retornar todo el historial (sin filtro) cuando idEmpresa es null', async () => {
      // Arrange
      const filasOracle = [mockFilaOracleHistorial(), mockFilaOracleHistorial({ ID_RESERVA: 2, PLACA: 'XYZ999' })];
      dataSource.query.mockResolvedValue(filasOracle);

      // Act
      const resultado = await service.getHistorialByEmpresa(null);

      // Assert
      expect(dataSource.query).toHaveBeenCalledWith('SELECT * FROM VW_HISTORIAL_RESERVAS');
      expect(Array.isArray(resultado)).toBe(true);
      expect(resultado.length).toBe(2);
    });

    it('Camino 1 (transformKeys): Las llaves deben estar en camelCase, sin guiones bajos', async () => {
      // Arrange
      dataSource.query.mockResolvedValue([mockFilaOracleHistorial()]);

      // Act
      const resultado = await service.getHistorialByEmpresa(null);

      // Assert — verifica la lógica interna de transformKeys
      const llaves = Object.keys(resultado[0]);
      const tieneGuionesBajos = llaves.some(key => key.includes('_'));
      expect(tieneGuionesBajos).toBe(false);
      expect(resultado[0]).toHaveProperty('idReserva');
      expect(resultado[0]).toHaveProperty('idCelda');
      expect(resultado[0]).toHaveProperty('estadoReserva');
      expect(resultado[0]).toHaveProperty('nombreCliente');
      expect(resultado[0]).toHaveProperty('numeroDocumento');
    });

    it('Camino 2: Debería retornar el historial filtrado por empresa (idEmpresa !== null)', async () => {
      // Arrange
      const filasOracle = [mockFilaOracleHistorial()];
      dataSource.query.mockResolvedValue(filasOracle);

      // Act
      const resultado = await service.getHistorialByEmpresa(1);

      // Assert
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.ID_EMPRESA = :1'),
        [1],
      );
      expect(resultado.length).toBe(1);
      expect(resultado[0].placa).toBe('ABC123');
    });

    it('Camino 3: Debería retornar arreglo vacío si la empresa no tiene historial', async () => {
      // Arrange
      dataSource.query.mockResolvedValue([]);

      // Act
      const resultado = await service.getHistorialByEmpresa(99999);

      // Assert
      expect(Array.isArray(resultado)).toBe(true);
      expect(resultado.length).toBe(0);
    });

  });

  // ══════════════════════════════════════════════════════════════════════════
  // getHistorialByPlacaAndParqueadero()
  // Caminos: con resultados | sin resultados
  // ══════════════════════════════════════════════════════════════════════════
  describe('getHistorialByPlacaAndParqueadero()', () => {

    it('Camino 1: Debería retornar el historial de una placa en un parqueadero específico', async () => {
      // Arrange
      const filasOracle = [
        mockFilaOracleHistorial({ PLACA: 'ABC123', ID_CELDA: 10 }),
        mockFilaOracleHistorial({ PLACA: 'ABC123', ID_CELDA: 11, ID_RESERVA: 2 }),
      ];
      dataSource.query.mockResolvedValue(filasOracle);

      // Act
      const resultado = await service.getHistorialByPlacaAndParqueadero('ABC123', 1);

      // Assert
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE v.PLACA = :1 AND c.ID_PARQUEADERO = :2'),
        ['ABC123', 1],
      );
      expect(resultado.length).toBe(2);
      expect(resultado[0].placa).toBe('ABC123');
    });

    it('Camino 2: Debería retornar arreglo vacío si la placa no tiene historial en ese parqueadero', async () => {
      // Arrange
      dataSource.query.mockResolvedValue([]);

      // Act
      const resultado = await service.getHistorialByPlacaAndParqueadero('NOEXISTE', 99999);

      // Assert
      expect(Array.isArray(resultado)).toBe(true);
      expect(resultado.length).toBe(0);
      expect(dataSource.query).toHaveBeenCalledTimes(1);
    });

  });

  // ══════════════════════════════════════════════════════════════════════════
  // transformKeys() — probada indirectamente a través de los métodos públicos
  // ══════════════════════════════════════════════════════════════════════════
  describe('transformKeys() — conversión ORACLE → camelCase (Nodo interno)', () => {

    it('Debería convertir correctamente columnas compuestas con múltiples segmentos', async () => {
      // Arrange — columna con tres segmentos: NOMBRE_DEL_CLIENTE → nombreDelCliente
      const filaCompleja = { NOMBRE_DEL_CLIENTE: 'Ana López', ID_RESERVA: 5 };
      dataSource.query.mockResolvedValue([filaCompleja]);

      // Act
      const resultado = await service.getHistorialByEmpresa(null);

      // Assert
      expect(resultado[0]).toHaveProperty('nombreDelCliente', 'Ana López');
      expect(resultado[0]).toHaveProperty('idReserva', 5);
    });

    it('Debería conservar los valores originales tras la transformación de llaves', async () => {
      // Arrange
      const fecha = new Date('2025-06-15T09:30:00');
      dataSource.query.mockResolvedValue([mockFilaOracleHistorial({ FECHA_INICIO: fecha, PLACA: 'ZZZ001' })]);

      // Act
      const resultado = await service.getHistorialByEmpresa(null);

      // Assert — los valores no deben alterarse, solo las llaves
      expect(resultado[0].placa).toBe('ZZZ001');
      expect(resultado[0].fechaInicio).toEqual(fecha);
    });

  });

});

// Emanuel
const dataSourceMock = { query: jest.fn() };

describe('VistasService', () => {
  let service: VistasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VistasService,
        { provide: getRepositoryToken(OcupacionParqueaderoView), useValue: {} },
        { provide: getRepositoryToken(HistorialReservasView), useValue: {} },
        { provide: getRepositoryToken(FacturacionCompletaView), useValue: {} },
        { provide: getRepositoryToken(IngresosPorParqueaderoMensualView), useValue: {} },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get(VistasService);
    jest.clearAllMocks();
  });

  it('debe retornar ocupacion por parqueadero con llaves transformadas', async () => {
    // Arrange
    dataSourceMock.query.mockResolvedValue([
      { ID_PARQUEADERO: 321, TOTAL_CELDAS: 10, CELDAS_OCUPADAS: 3 },
    ]);

    // Act
    const result = await service.getOcupacionByParqueadero(321);

    // Assert
    expect(result).toEqual({ idParqueadero: 321, totalCeldas: 10, celdasOcupadas: 3 });
    expect(dataSourceMock.query).toHaveBeenCalledTimes(1);
    expect(dataSourceMock.query).toHaveBeenCalledWith(
      'SELECT * FROM VW_OCUPACION_PARQUEADERO WHERE ID_PARQUEADERO = :1',
      [321],
    );
  });

  it('debe retornar null si no hay ocupacion', async () => {
    // Arrange
    dataSourceMock.query.mockResolvedValue([]);

    // Act
    const result = await service.getOcupacionByParqueadero(999);

    // Assert
    expect(result).toBeNull();
  });

  it('debe retornar ocupacion por empresa cuando idEmpresa es null', async () => {
    // Arrange
    dataSourceMock.query.mockResolvedValue([{ ID_PARQUEADERO: 1, TOTAL_CELDAS: 5 }]);

    // Act
    const result = await service.getOcupacionByEmpresa(null);

    // Assert
    expect(result).toEqual([{ idParqueadero: 1, totalCeldas: 5 }]);
    expect(dataSourceMock.query).toHaveBeenCalledWith('SELECT * FROM VW_OCUPACION_PARQUEADERO');
  });

  it('debe retornar ocupacion filtrada por empresa', async () => {
    // Arrange
    dataSourceMock.query.mockResolvedValue([{ ID_PARQUEADERO: 2 }]);

    // Act
    const result = await service.getOcupacionByEmpresa(10);

    // Assert
    expect(result).toEqual([{ idParqueadero: 2 }]);
    expect(dataSourceMock.query).toHaveBeenCalledWith(expect.stringContaining('WHERE p.ID_EMPRESA = :1'), [10]);
  });

  it('debe retornar historial por empresa sin filtro', async () => {
    // Arrange
    dataSourceMock.query.mockResolvedValue([{ ID_RESERVA: 99 }]);

    // Act
    const result = await service.getHistorialByEmpresa(null);

    // Assert
    expect(result).toEqual([{ idReserva: 99 }]);
    expect(dataSourceMock.query).toHaveBeenCalledWith('SELECT * FROM VW_HISTORIAL_RESERVAS');
  });

  it('debe retornar historial por empresa con filtro', async () => {
    // Arrange
    dataSourceMock.query.mockResolvedValue([{ ID_RESERVA: 100 }]);

    // Act
    const result = await service.getHistorialByEmpresa(3);

    // Assert
    expect(result).toEqual([{ idReserva: 100 }]);
    expect(dataSourceMock.query).toHaveBeenCalledWith(expect.stringContaining('WHERE p.ID_EMPRESA = :1'), [3]);
  });

  it('debe retornar historial por placa y parqueadero', async () => {
    // Arrange
    dataSourceMock.query.mockResolvedValue([{ PLACA: 'ABC123', ID_CELDA: 1 }]);

    // Act
    const result = await service.getHistorialByPlacaAndParqueadero('ABC123', 321);

    // Assert
    expect(result).toEqual([{ placa: 'ABC123', idCelda: 1 }]);
    expect(dataSourceMock.query).toHaveBeenCalledWith(expect.stringContaining('WHERE v.PLACA = :1 AND c.ID_PARQUEADERO = :2'), ['ABC123', 321]);
  });

  it('debe retornar facturacion por empresa sin filtro', async () => {
    // Arrange
    dataSourceMock.query.mockResolvedValue([{ ID_PAGO: 11 }]);

    // Act
    const result = await service.getFacturacionByEmpresa(null);

    // Assert
    expect(result).toEqual([{ idPago: 11 }]);
    expect(dataSourceMock.query).toHaveBeenCalledWith('SELECT * FROM VW_FACTURACION_COMPLETA');
  });

  it('debe retornar facturacion por empresa con filtro', async () => {
    // Arrange
    dataSourceMock.query.mockResolvedValue([{ ID_PAGO: 12 }]);

    // Act
    const result = await service.getFacturacionByEmpresa(8);

    // Assert
    expect(result).toEqual([{ idPago: 12 }]);
    expect(dataSourceMock.query).toHaveBeenCalledWith(expect.stringContaining('WHERE p.ID_EMPRESA = :1'), [8]);
  });

  it('debe retornar facturacion por documento sin empresa', async () => {
    // Arrange
    dataSourceMock.query.mockResolvedValue([{ NUMERO_DOCUMENTO: '123' }]);

    // Act
    const result = await service.getFacturacionByDocumento('123', null);

    // Assert
    expect(result).toEqual([{ numeroDocumento: '123' }]);
    expect(dataSourceMock.query).toHaveBeenCalledWith(
      'SELECT * FROM VW_FACTURACION_COMPLETA WHERE NUMERO_DOCUMENTO = :1',
      ['123'],
    );
  });

  it('debe retornar facturacion por documento con empresa', async () => {
    // Arrange
    dataSourceMock.query.mockResolvedValue([{ NUMERO_DOCUMENTO: '999' }]);

    // Act
    const result = await service.getFacturacionByDocumento('999', 5);

    // Assert
    expect(result).toEqual([{ numeroDocumento: '999' }]);
    expect(dataSourceMock.query).toHaveBeenCalledWith(expect.stringContaining('WHERE v.NUMERO_DOCUMENTO = :1 AND p.ID_EMPRESA = :2'), ['999', 5]);
  });

  it('debe retornar ingresos por empresa sin filtro', async () => {
    // Arrange
    dataSourceMock.query.mockResolvedValue([{ PARQUEADERO: 'Central' }]);

    // Act
    const result = await service.getIngresosByEmpresa(null);

    // Assert
    expect(result).toEqual([{ parqueadero: 'Central' }]);
    expect(dataSourceMock.query).toHaveBeenCalledWith('SELECT * FROM VW_INGRESOS_POR_PARQUEADERO_MENSUAL');
  });

  it('debe retornar ingresos por empresa con filtro', async () => {
    // Arrange
    dataSourceMock.query.mockResolvedValue([{ PARQUEADERO: 'Norte' }]);

    // Act
    const result = await service.getIngresosByEmpresa(2);

    // Assert
    expect(result).toEqual([{ parqueadero: 'Norte' }]);
    expect(dataSourceMock.query).toHaveBeenCalledWith(expect.stringContaining('WHERE p.ID_EMPRESA = :1'), [2]);
  });

  it('debe retornar ingresos por parqueadero', async () => {
    // Arrange
    dataSourceMock.query.mockResolvedValue([{ PARQUEADERO: 'Sur' }]);

    // Act
    const result = await service.getIngresosByParqueadero(321);

    // Assert
    expect(result).toEqual([{ parqueadero: 'Sur' }]);
    expect(dataSourceMock.query).toHaveBeenCalledWith(expect.stringContaining('WHERE p.ID_PARQUEADERO = :1'), [321]);
  });

  it('debe procesar pago y retornar monto', async () => {
    // Arrange
    dataSourceMock.query.mockResolvedValue(15000);

    // Act
    const result = await service.procesarPago(10, 2);

    // Assert
    expect(result).toEqual({ monto: 15000 });
    expect(dataSourceMock.query).toHaveBeenCalledWith(expect.stringContaining('PKG_CENTRAL.PROC_CONTROL_PAGO'), expect.any(Array));
  });

  it('debe buscar vehiculo por placa y retornar mensaje', async () => {
    // Arrange
    dataSourceMock.query.mockResolvedValue('ENCONTRADO');

    // Act
    const result = await service.buscarVehiculoPorPlaca('ABC123');

    // Assert
    expect(result).toEqual({ mensaje: 'ENCONTRADO' });
    expect(dataSourceMock.query).toHaveBeenCalledWith(expect.stringContaining('PKG_CENTRAL.PROC_BUSCAR_PLACA'), expect.any(Array));
  });
});