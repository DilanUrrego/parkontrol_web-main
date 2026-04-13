import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParqueaderosService } from './parqueaderos.service';
import { Parqueadero } from './entities/parqueadero.entity';
import { Empresa } from '../empresas/entities/empresa.entity';
import { EmpresasService } from '../empresas/empresas.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { NotFoundException } from '@nestjs/common/exceptions/not-found.exception';
import { ParqueaderoResponseDto } from './entities/dto/parqueadero-response.dto';
dotenv.config({ path: __dirname + '/../../.env' });

describe('ParqueaderosService (Prueba de Integración Real)', () => {
  let service: ParqueaderosService;
  let parqueaderoRepo: Repository<Parqueadero>;
  let empresaRepo: Repository<Empresa>;
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
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          logging: true,
          synchronize: false, // No ponerlo en true
        }),
        TypeOrmModule.forFeature([Parqueadero, Empresa]),
      ],
      providers: [ParqueaderosService, EmpresasService],
    }).compile();

    service = module.get<ParqueaderosService>(ParqueaderosService);
    parqueaderoRepo = module.get<Repository<Parqueadero>>(getRepositoryToken(Parqueadero));
    empresaRepo = module.get<Repository<Empresa>>(getRepositoryToken(Empresa));
  }, 20000);

  it('Debería listar parqueaderos filtrados por empresa (Caja Blanca)', async () => {
    // 1. ARRANGE (Preparar datos en la DB real)
    // Buscamos una empresa que ya exista para no crear conflictos
    const empresa = await empresaRepo.findOne({ where: {} }); 
    
    if (!empresa) {
        console.warn('No hay empresas en la DB para probar. Crea una primero.');
        return;
    }

    // Creamos un parqueadero temporal
    const nuevoP = parqueaderoRepo.create({
      nombre: 'Parqueadero de Prueba',
      capacidadTotal: 50,
      ubicacion: 'Calle Test 123',
      empresa: empresa
    });
    const guardado = await parqueaderoRepo.save(nuevoP);

    // 2. ACT (Ejecutar la lógica del servicio)
    const resultados = await service.findByEmpresa(empresa.id);

    console.log('--- DATOS RECUPERADOS DEL SERVICIO ---');
    console.log(resultados);
    console.log('Cantidad de parqueaderos encontrados:', resultados.length);

    // 3. ASSERT (Verificar que la lógica de caja blanca funcionó)
    expect(resultados.length).toBeGreaterThan(0);
    expect(resultados.some(p => p.nombre === 'Parqueadero de Prueba')).toBe(true);

    // Borramos el dato de prueba para dejar la DB limpia
    await parqueaderoRepo.delete(guardado.id);
  });

  // ... (debajo del test anterior)

  it('Debería retornar un arreglo vacío cuando el idEmpresa no existe (ID inexistente)', async () => {
    // 1. ARRANGE: Usamos un ID que sabemos que no existe (ej. 999999)
    const idInvalido = 999999;

    // 2. ACT: Llamamos al servicio
    const resultados = await service.findByEmpresa(idInvalido);

    // 3. ASSERT: El servicio debe responder con un array vacío
    console.log('--- TEST ID INEXISTENTE ---');
    console.log('Resultados para ID 999999:', resultados);

    expect(Array.isArray(resultados)).toBe(true);
    expect(resultados.length).toBe(0);
  });

  it('Debería manejar correctamente un ID que no es un entero (Casting manual)', async () => {
    // Nota: Aunque el Pipe lo frena en el Controller, 
    // probamos el Service enviando un valor decimal o similar.
    
    const idDecimal = 1.5;

    // ACT
    const resultados = await service.findByEmpresa(idDecimal as any);

    // ASSERT
    // TypeORM al recibir un decimal en una búsqueda de entero 
    // simplemente no encontrará coincidencia o retornará vacío.
    expect(resultados.length).toBe(0);
  });

  afterAll(async () => {
    if (module) await module.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fábricas de datos de prueba
// ─────────────────────────────────────────────────────────────────────────────
const mockEmpresa = () =>
  ({ id: 1, nombre: 'Empresa Test S.A.' } as any);

const mockParqueadero = (overrides: Partial<Parqueadero> = {}): Parqueadero =>
  ({
    id: 1,
    nombre: 'Parqueadero Central',
    capacidadTotal: 50,
    ubicacion: 'Calle Test 123',
    empresa: mockEmpresa(),
    ...overrides,
  } as Parqueadero);

// ─────────────────────────────────────────────────────────────────────────────
// Mocks de repositorio y servicio externo
// ─────────────────────────────────────────────────────────────────────────────
const mockParqueaderoRepository = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockEmpresasService = () => ({
  findEmpresaById: jest.fn(),
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ParqueaderosService - Pruebas Unitarias (Caja Blanca)', () => {
  let service: ParqueaderosService;
  let parqueaderoRepo: ReturnType<typeof mockParqueaderoRepository>;
  let empresasService: ReturnType<typeof mockEmpresasService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParqueaderosService,
        { provide: getRepositoryToken(Parqueadero), useFactory: mockParqueaderoRepository },
        { provide: EmpresasService,                 useFactory: mockEmpresasService },
      ],
    }).compile();

    service           = module.get<ParqueaderosService>(ParqueaderosService);
    parqueaderoRepo   = module.get(getRepositoryToken(Parqueadero));
    empresasService   = module.get(EmpresasService);
  });

  afterEach(() => jest.clearAllMocks());

  // ══════════════════════════════════════════════════════════════════════════
  // HU: CREAR PARQUEADERO
  // ══════════════════════════════════════════════════════════════════════════
  describe('crear() - Crear Parqueadero', () => {

    it('Camino 1: Debería lanzar NotFoundException si la empresa no existe', async () => {
      // Arrange
      const dto = { nombre: 'Parqueadero Nuevo', capacidadTotal: 100, ubicacion: 'Calle 10', idEmpresa: 99999 };
      empresasService.findEmpresaById.mockRejectedValue(
        new NotFoundException('Empresa con id: 99999 no existe'),
      );

      // Act
      const accion = service.crear(dto);

      // Assert
      await expect(accion).rejects.toThrow(NotFoundException);
      await expect(accion).rejects.toThrow('Empresa con id: 99999 no existe');
      expect(parqueaderoRepo.save).not.toHaveBeenCalled();
    });

    it('Camino 2: Debería crear y retornar el parqueadero correctamente', async () => {
      // Arrange
      const dto = { nombre: 'Parqueadero Nuevo', capacidadTotal: 100, ubicacion: 'Calle 10', idEmpresa: 1 };
      const parqueaderoGuardado = mockParqueadero({ nombre: dto.nombre, capacidadTotal: dto.capacidadTotal });
      empresasService.findEmpresaById.mockResolvedValue(mockEmpresa());
      parqueaderoRepo.create.mockReturnValue(parqueaderoGuardado);
      parqueaderoRepo.save.mockResolvedValue(parqueaderoGuardado);

      // Act
      const resultado = await service.crear(dto);

      // Assert
      expect(resultado).toBeDefined();
      expect(resultado).toBeInstanceOf(ParqueaderoResponseDto);
      expect(resultado.nombre).toBe('Parqueadero Nuevo');
      expect(parqueaderoRepo.create).toHaveBeenCalledTimes(1);
      expect(parqueaderoRepo.save).toHaveBeenCalledTimes(1);
    });

  });

  // ══════════════════════════════════════════════════════════════════════════
  // HU: BUSCAR PARQUEADERO POR ID
  // ══════════════════════════════════════════════════════════════════════════
  describe('findParqueaderoById() - Buscar por ID', () => {

    it('Camino 1: Debería lanzar NotFoundException si el parqueadero no existe', async () => {
      // Arrange
      parqueaderoRepo.findOne.mockResolvedValue(null);

      // Act
      const accion = service.findParqueaderoById(99999);

      // Assert
      await expect(accion).rejects.toThrow(NotFoundException);
      await expect(accion).rejects.toThrow('Parqueadero con id: 99999 no existe');
      expect(parqueaderoRepo.findOne).toHaveBeenCalledWith({
        where: { id: 99999 },
        relations: ['empresa'],
      });
    });

    it('Camino 2: Debería retornar el parqueadero si existe', async () => {
      // Arrange
      const parqueaderoEsperado = mockParqueadero();
      parqueaderoRepo.findOne.mockResolvedValue(parqueaderoEsperado);

      // Act
      const resultado = await service.findParqueaderoById(1);

      // Assert
      expect(resultado).toBeDefined();
      expect(resultado.id).toBe(1);
      expect(resultado.nombre).toBe('Parqueadero Central');
    });

  });

  // ══════════════════════════════════════════════════════════════════════════
  // HU: LISTAR TODOS LOS PARQUEADEROS
  // ══════════════════════════════════════════════════════════════════════════
  describe('findAll() - Listar todos los parqueaderos', () => {

    it('Camino 1: Debería retornar la lista de todos los parqueaderos', async () => {
      // Arrange
      const parqueaderosEsperados = [mockParqueadero(), mockParqueadero({ id: 2, nombre: 'Parqueadero Norte' })];
      parqueaderoRepo.find.mockResolvedValue(parqueaderosEsperados);

      // Act
      const resultado = await service.findAll();

      // Assert
      expect(Array.isArray(resultado)).toBe(true);
      expect(resultado.length).toBe(2);
      expect(resultado[0]).toBeInstanceOf(ParqueaderoResponseDto);
      expect(parqueaderoRepo.find).toHaveBeenCalledWith({ relations: ['empresa'] });
    });

    it('Camino 2: Debería retornar arreglo vacío si no hay parqueaderos', async () => {
      // Arrange
      parqueaderoRepo.find.mockResolvedValue([]);

      // Act
      const resultado = await service.findAll();

      // Assert
      expect(Array.isArray(resultado)).toBe(true);
      expect(resultado.length).toBe(0);
    });

  });

  // ══════════════════════════════════════════════════════════════════════════
  // HU: LISTAR PARQUEADEROS POR EMPRESA
  // ══════════════════════════════════════════════════════════════════════════
  describe('findByEmpresa() - Listar parqueaderos filtrados por empresa', () => {

    it('Camino 1: Debería retornar los parqueaderos de la empresa cuando existen', async () => {
      // Arrange
      const parqueaderosEsperados = [
        mockParqueadero(),
        mockParqueadero({ id: 2, nombre: 'Parqueadero Sur' }),
      ];
      parqueaderoRepo.find.mockResolvedValue(parqueaderosEsperados);

      // Act
      const resultado = await service.findByEmpresa(1);

      // Assert
      expect(Array.isArray(resultado)).toBe(true);
      expect(resultado.length).toBe(2);
      expect(resultado[0]).toBeInstanceOf(ParqueaderoResponseDto);
      expect(parqueaderoRepo.find).toHaveBeenCalledWith({
        where: { empresa: { id: 1 } },
        relations: ['empresa'],
      });
    });

    it('Camino 2: Debería retornar arreglo vacío si la empresa no tiene parqueaderos (ID inexistente)', async () => {
      // Arrange
      parqueaderoRepo.find.mockResolvedValue([]);

      // Act
      const resultado = await service.findByEmpresa(99999);

      // Assert
      expect(Array.isArray(resultado)).toBe(true);
      expect(resultado.length).toBe(0);
    });

    it('Camino 3: Debería retornar arreglo vacío si el ID recibido es un decimal (valor no entero)', async () => {
      // Arrange — aunque el Pipe lo bloquea en el Controller,
      // el Service debe comportarse de forma segura ante valores inesperados
      parqueaderoRepo.find.mockResolvedValue([]);

      // Act
      const resultado = await service.findByEmpresa(1.5 as any);

      // Assert
      expect(Array.isArray(resultado)).toBe(true);
      expect(resultado.length).toBe(0);
    });

  });

  // ══════════════════════════════════════════════════════════════════════════
  // HU: OBTENER DETALLE DE PARQUEADERO
  // ══════════════════════════════════════════════════════════════════════════
  describe('obtenerDetalle() - Obtener detalle de un parqueadero', () => {

    it('Camino 1: Debería lanzar NotFoundException si el parqueadero no existe', async () => {
      // Arrange
      parqueaderoRepo.findOne.mockResolvedValue(null);

      // Act
      const accion = service.obtenerDetalle(99999);

      // Assert
      await expect(accion).rejects.toThrow(NotFoundException);
    });

    it('Camino 2: Debería retornar el DTO de detalle si el parqueadero existe', async () => {
      // Arrange
      const parqueaderoEsperado = mockParqueadero();
      parqueaderoRepo.findOne.mockResolvedValue(parqueaderoEsperado);

      // Act
      const resultado = await service.obtenerDetalle(1);

      // Assert
      expect(resultado).toBeDefined();
      expect(resultado).toBeInstanceOf(ParqueaderoResponseDto);
      expect(resultado.nombre).toBe('Parqueadero Central');
    });

  });

});


// Pruebas Dilan & vale

describe('ParqueaderosService - HU07 findParqueaderoById', () => {
  let service: ParqueaderosService;
  let repository: jest.Mocked<Repository<Parqueadero>>;

  const mockRepository = {
    findOne: jest.fn(),
  };

  const mockEmpresasService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParqueaderosService,
        {
          provide: getRepositoryToken(Parqueadero),
          useValue: mockRepository,
        },
        {
          provide: EmpresasService,
          useValue: mockEmpresasService,
        },
      ],
    }).compile();

    service = module.get<ParqueaderosService>(ParqueaderosService);
    repository = module.get(getRepositoryToken(Parqueadero));
    jest.clearAllMocks();
  });

  // ✅ CAMINO 1: 1-2-3-4 → retorna el parqueadero
  it('debe retornar el parqueadero cuando existe (Camino 1-2-3-4)', async () => {
    const id = 1;

    const parqueaderoMock = {
      id: 1,
      nombre: 'Parqueadero Central',
      capacidadTotal: 100,
      ubicacion: 'Centro',
      empresa: { id: 10 },
    } as Parqueadero;

    repository.findOne.mockResolvedValue(parqueaderoMock);

    const resultado = await service.findParqueaderoById(id);

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id },
      relations: ['empresa'],
    });

    expect(resultado).toBe(parqueaderoMock);
  });

  // ❌ CAMINO 2: 1-2-3-5 → lanza NotFoundException
  it('debe lanzar NotFoundException cuando no existe (Camino 1-2-3-5)', async () => {
    const id = 999;

    repository.findOne.mockResolvedValue(null);

    await expect(service.findParqueaderoById(id))
      .rejects
      .toThrow(NotFoundException);

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id },
      relations: ['empresa'],
    });
  });
});

// Dilan y vale

describe('ParqueaderosService (UNIT - AAA)', () => {
  let service: ParqueaderosService;
  let repository: jest.Mocked<Repository<Parqueadero>>;

  const mockParqueaderoRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockEmpresasService = {
    findEmpresaById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParqueaderosService,
        { provide: EmpresasService, useValue: mockEmpresasService },
        { provide: getRepositoryToken(Parqueadero), useValue: mockParqueaderoRepository },
      ],
    }).compile();

    service = module.get<ParqueaderosService>(ParqueaderosService);
    repository = module.get(getRepositoryToken(Parqueadero));
    jest.clearAllMocks();
  });

  const dtoBase = {
    nombre: 'Parqueadero Test',
    capacidadTotal: 50,
    ubicacion: 'Calle 123',
    idEmpresa: 1
  };

  // Pruebas de creación
  describe('crear', () => {

    it('C2: Debe crear parqueadero correctamente', async () => {
      const empresaMock = { id: 1 };
      const parqueaderoMock = { id: 1, ...dtoBase, empresa: empresaMock };

      mockEmpresasService.findEmpresaById.mockResolvedValue(empresaMock);
      mockParqueaderoRepository.create.mockReturnValue(parqueaderoMock);
      mockParqueaderoRepository.save.mockResolvedValue(parqueaderoMock);

      const result = await service.crear(dtoBase as any);

      expect(result).toBeInstanceOf(ParqueaderoResponseDto);
      expect(result.id).toBe(1);
      expect(mockParqueaderoRepository.create).toHaveBeenCalled();
      expect(mockParqueaderoRepository.save).toHaveBeenCalled();
    });

    it('C3: Debe crear usando datos correctos', async () => {
      const empresaMock = { id: 1 };
      mockEmpresasService.findEmpresaById.mockResolvedValue(empresaMock);

      await service.crear(dtoBase as any);

      expect(mockParqueaderoRepository.create).toHaveBeenCalledWith({
        nombre: dtoBase.nombre,
        capacidadTotal: dtoBase.capacidadTotal,
        ubicacion: dtoBase.ubicacion,
        empresa: empresaMock
      });
    });
  });

  // Pruebas de findParqueaderoById (HU07)
  describe('findParqueaderoById', () => {
    it('debe retornar el parqueadero cuando existe (Camino 1-2-3-4)', async () => {
      const id = 1;
      const parqueaderoMock = {
        id: 1,
        nombre: 'Parqueadero Central',
        capacidadTotal: 100,
        ubicacion: 'Centro',
        empresa: { id: 10 },
      } as Parqueadero;

      mockParqueaderoRepository.findOne.mockResolvedValue(parqueaderoMock);

      const resultado = await service.findParqueaderoById(id);

      expect(mockParqueaderoRepository.findOne).toHaveBeenCalledWith({
        where: { id },
        relations: ['empresa'],
      });

      expect(resultado).toBe(parqueaderoMock);
    });

    it('debe lanzar NotFoundException cuando no existe (Camino 1-2-3-5)', async () => {
      const id = 999;
      mockParqueaderoRepository.findOne.mockResolvedValue(null);

      await expect(service.findParqueaderoById(id))
        .rejects
        .toThrow(NotFoundException);

      expect(mockParqueaderoRepository.findOne).toHaveBeenCalledWith({
        where: { id },
        relations: ['empresa'],
      });
    });
  });

  // Pruebas de listado
  describe('findAll', () => {
    it('C6: Debe listar todos los parqueaderos', async () => {
      const mock = [{ id: 1, empresa: {} }];
      mockParqueaderoRepository.find.mockResolvedValue(mock);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(ParqueaderoResponseDto);
    });

    it('C7: Debe retornar lista vacía', async () => {
      mockParqueaderoRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // Pruebas de findByEmpresa
  describe('findByEmpresa', () => {
    it('C8: Debe listar parqueaderos por empresa', async () => {
      const mock = [{ id: 1, empresa: { id: 1 } }];
      mockParqueaderoRepository.find.mockResolvedValue(mock);

      const result = await service.findByEmpresa(1);

      expect(result).toHaveLength(1);
    });

    it('C9: Debe retornar vacío si no hay parqueaderos', async () => {
      mockParqueaderoRepository.find.mockResolvedValue([]);

      const result = await service.findByEmpresa(999);

      expect(result).toEqual([]);
    });
  });

  // Pruebas de obtenerDetalle
  describe('obtenerDetalle', () => {
    it('C10: Debe obtener detalle correctamente', async () => {
      const mock = { id: 1, empresa: {} };
      mockParqueaderoRepository.findOne.mockResolvedValue(mock);

      const result = await service.obtenerDetalle(1);

      expect(result).toBeInstanceOf(ParqueaderoResponseDto);
    });

    it('C11: Debe lanzar error en detalle si no existe', async () => {
      mockParqueaderoRepository.findOne.mockResolvedValue(null);

      await expect(service.obtenerDetalle(999))
        .rejects.toThrow(NotFoundException);
    });
  });
});