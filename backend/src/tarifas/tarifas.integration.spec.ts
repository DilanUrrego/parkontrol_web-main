import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TarifasService } from './tarifas.service';
import { Tarifa } from './entities/tarifa.entity';
import { Parqueadero } from '../parqueaderos/entities/parqueadero.entity';
import { TipoVehiculo } from '../shared/entities/tipo-vehiculo.entity';
import { ParqueaderosService } from '../parqueaderos/parqueaderos.service';
import { EmpresasService } from '../empresas/empresas.service';
import { Empresa } from '../empresas/entities/empresa.entity';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Rol } from '../shared/entities/rol.entity';
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../../.env' });

describe('TarifasService - Pruebas de Integración (Oracle Real)', () => {
  let service: TarifasService;
  let tarifaRepo: Repository<Tarifa>;
  let module: TestingModule;
  let idTarifaCreada: number | null = null;

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
          logging: false,
          synchronize: false,
        }),
        TypeOrmModule.forFeature([Tarifa, TipoVehiculo, Parqueadero, Empresa, Usuario, Rol]),
      ],
      providers: [TarifasService, ParqueaderosService, EmpresasService],
    }).compile();

    service = module.get<TarifasService>(TarifasService);
    tarifaRepo = module.get<Repository<Tarifa>>(getRepositoryToken(Tarifa));
  }, 20000);

  //Borra la tarifa si el test creó una
  afterEach(async () => {
    if (idTarifaCreada) {
      await tarifaRepo.delete(idTarifaCreada);
      idTarifaCreada = null;
    }
  });

  afterAll(async () => {
    if (module) await module.close();
  });

  // ==========================================================================
  // HU-27: CREAR TARIFA
  // ==========================================================================
  describe('HU-27: Crear Tarifa (Caja Blanca)', () => {
    it('Camino 1: Debería lanzar NotFoundException si el tipo de vehículo no existe (N1-2-3-4-5-F)', async () => {
      const dtoInvalido = {
        precioFraccionHora: 2000,
        precioHoraAdicional: 3000,
        idParqueadero: 1,
        idTipoVehiculo: 99999
      };
      await expect(service.crear(dtoInvalido)).rejects.toThrow(NotFoundException);
    });

    it('Camino 2: Debería crear y retornar la tarifa correctamente (N1-2-3-4-6-7-8-F)', async () => {
      const dtoValido = {
        precioFraccionHora: 1800,
        precioHoraAdicional: 3500,
        idParqueadero: 1,
        idTipoVehiculo: 1
      };

      const resultado = await service.crear(dtoValido);
      idTarifaCreada = resultado.id; // Se guardó el ID para que afterEach lo borre

      expect(resultado).toBeDefined();
      expect(resultado).toHaveProperty('id');
      expect(Number(resultado.precioFraccionHora)).toBe(1800);
    });
  });

  // ==========================================================================
  // HU-28: LISTAR TARIFAS
  // ==========================================================================
  describe('HU-28: Listar Tarifas por Parqueadero (Caja Blanca)', () => {
    it('Camino 1: Debería retornar la lista de tarifas (Nodos 1-6)', async () => {
      const resultado = await service.findByParqueadero(1);
      expect(Array.isArray(resultado)).toBe(true);
    });

    it('Camino 2: Arreglo vacío si no tiene tarifas (Nodos 1-2-7-F)', async () => {
      const resultado = await service.findByParqueadero(99999);
      expect(resultado.length).toBe(0);
    });
  });

  // ==========================================================================
  // HU-29: ACTUALIZAR TARIFA
  // ==========================================================================
  describe('HU-29: Actualizar Tarifa (Caja Blanca)', () => {
    // CAMINO 1: ID no existe -> NotFoundException
    it('Camino 1: Debería lanzar NotFoundException si el ID no existe (Nodos 1-2-3-4-F)', async () => {
    const idInexistente = 999999;
    await expect(service.actualizar(idInexistente, { precioFraccionHora: 1000 }))
      .rejects.toThrow(NotFoundException);
    });

    // --- CAMINO 2: No hacer nada (Body vacío) ---
    it('Camino 2: No debería ejecutar UPDATE si el body está vacío (Nodos 1-2-3-5-6-8-10-12-13-15-F)', async () => {
    const idTarifa = 1; // Tarifa base que ya tienes
    const tarifaAntes = await service.findTarifaById(idTarifa);
    
    const resultado = await service.actualizar(idTarifa, {});
    
    expect(resultado.precioFraccionHora).toBe(tarifaAntes.precioFraccionHora);
    expect(resultado.precioHoraAdicional).toBe(tarifaAntes.precioHoraAdicional);
    });

    // --- CAMINO 3: Actualizar solo el precio de fracción ---
    it('Camino 3: Debería actualizar solo el precio de fracción (Nodos 1-2-3-5-6-7-8-10-11-12-13-15-F)', async () => {
    const idTarifa = 1;
    const nuevoPrecio = 2500;
    
    const resultado = await service.actualizar(idTarifa, { precioFraccionHora: nuevoPrecio });
    
    expect(resultado.precioFraccionHora).toBe(nuevoPrecio);
    });

    // --- CAMINO 4: Actualizar solo el precio de hora adicional ---
    it('Camino 4: Debería actualizar solo el precio de hora adicional (Nodos 1-2-3-5-6-8-9-10-11-12-13-15-F)', async () => {
    const idTarifa = 1;
    const nuevoPrecioAdicional = 3500;
    
    const resultado = await service.actualizar(idTarifa, { precioHoraAdicional: nuevoPrecioAdicional });
    
    expect(resultado.precioHoraAdicional).toBe(nuevoPrecioAdicional);
    });

    // --- CAMINO 5: Actualizar todo ---
    it('Camino 5: Debería actualizar ambos precios (Nodos 1-2-3-5-6-7-8-9-10-11-12-13-15-F)', async () => {
    const idTarifa = 1;
    const updateData = { precioFraccionHora: 5500, precioHoraAdicional: 2000 };
    
    const resultado = await service.actualizar(idTarifa, updateData);
    
    expect(resultado.precioFraccionHora).toBe(5500);
    expect(resultado.precioHoraAdicional).toBe(2000);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fábricas de datos de prueba
// ─────────────────────────────────────────────────────────────────────────────
const mockTipoVehiculo = (): TipoVehiculo =>
  ({ id: 1, nombre: 'Carro' } as TipoVehiculo);

const mockParqueadero = () =>
  ({ id: 1, nombre: 'Parqueadero Central' } as any);

const mockTarifa = (overrides: Partial<Tarifa> = {}): Tarifa =>
  ({
    id: 1,
    precioFraccionHora: 2000,
    precioHoraAdicional: 3000,
    parqueadero: mockParqueadero(),
    tipoVehiculo: mockTipoVehiculo(),
    ...overrides,
  } as Tarifa);

// ─────────────────────────────────────────────────────────────────────────────
// Mocks de repositorios y servicio externo
// ─────────────────────────────────────────────────────────────────────────────
const mockTarifaRepository = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  query: jest.fn(),
});

const mockTipoVehiculoRepository = () => ({
  findOne: jest.fn(),
});

const mockParqueaderosService = () => ({
  findParqueaderoById: jest.fn(),
});

// ─────────────────────────────────────────────────────────────────────────────
describe('TarifasService - Pruebas Unitarias (Caja Blanca)', () => {
  let service: TarifasService;
  let tarifaRepo: ReturnType<typeof mockTarifaRepository>;
  let tipoVehiculoRepo: ReturnType<typeof mockTipoVehiculoRepository>;
  let parqueaderosService: ReturnType<typeof mockParqueaderosService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TarifasService,
        { provide: getRepositoryToken(Tarifa),       useFactory: mockTarifaRepository },
        { provide: getRepositoryToken(TipoVehiculo), useFactory: mockTipoVehiculoRepository },
        { provide: ParqueaderosService,              useFactory: mockParqueaderosService },
      ],
    }).compile();

    service             = module.get<TarifasService>(TarifasService);
    tarifaRepo          = module.get(getRepositoryToken(Tarifa));
    tipoVehiculoRepo    = module.get(getRepositoryToken(TipoVehiculo));
    parqueaderosService = module.get(ParqueaderosService);
  });

  afterEach(() => jest.clearAllMocks());

  // ══════════════════════════════════════════════════════════════════════════
  // HU-27: CREAR TARIFA
  // ══════════════════════════════════════════════════════════════════════════
  describe('HU-27: crear() - Crear Tarifa', () => {

    it('Camino 1: Debería lanzar NotFoundException si el tipo de vehículo no existe (N1-2-3-4-5-F)', async () => {
      // Arrange
      const dto = { precioFraccionHora: 2000, precioHoraAdicional: 3000, idParqueadero: 1, idTipoVehiculo: 99999 };
      parqueaderosService.findParqueaderoById.mockResolvedValue(mockParqueadero());
      tipoVehiculoRepo.findOne.mockResolvedValue(null); // Tipo de vehículo inexistente

      // Act
      const accion = service.crear(dto);

      // Assert
      await expect(accion).rejects.toThrow(NotFoundException);
      await expect(accion).rejects.toThrow('No existe tipo de vehículo con id: 99999');
      expect(tipoVehiculoRepo.findOne).toHaveBeenCalledWith({ where: { id: 99999 } });
      expect(tarifaRepo.save).not.toHaveBeenCalled();
    });

    it('Camino 2: Debería crear y retornar la tarifa correctamente (N1-2-3-4-6-7-8-F)', async () => {
      // Arrange
      const dto = { precioFraccionHora: 1800, precioHoraAdicional: 3500, idParqueadero: 1, idTipoVehiculo: 1 };
      const tarifaEsperada = mockTarifa({ precioFraccionHora: 1800, precioHoraAdicional: 3500 });
      parqueaderosService.findParqueaderoById.mockResolvedValue(mockParqueadero());
      tipoVehiculoRepo.findOne.mockResolvedValue(mockTipoVehiculo());
      tarifaRepo.create.mockReturnValue(tarifaEsperada);
      tarifaRepo.save.mockResolvedValue(tarifaEsperada);

      // Act
      const resultado = await service.crear(dto);

      // Assert
      expect(resultado).toBeDefined();
      expect(resultado).toHaveProperty('id');
      expect(resultado.precioFraccionHora).toBe(1800);
      expect(resultado.precioHoraAdicional).toBe(3500);
      expect(tarifaRepo.create).toHaveBeenCalledTimes(1);
      expect(tarifaRepo.save).toHaveBeenCalledTimes(1);
    });

  });

  // ══════════════════════════════════════════════════════════════════════════
  // HU-28: LISTAR TARIFAS
  // ══════════════════════════════════════════════════════════════════════════
  describe('HU-28: findByParqueadero() - Listar Tarifas por Parqueadero', () => {

    it('Camino 1: Debería retornar la lista de tarifas cuando existen (N1-2-3-4-5-6-F)', async () => {
      // Arrange
      const tarifasEsperadas = [mockTarifa(), mockTarifa({ id: 2, precioFraccionHora: 2500 })];
      tarifaRepo.find.mockResolvedValue(tarifasEsperadas);

      // Act
      const resultado = await service.findByParqueadero(1);

      // Assert
      expect(Array.isArray(resultado)).toBe(true);
      expect(resultado.length).toBe(2);
      expect(tarifaRepo.find).toHaveBeenCalledWith({
        where: { parqueadero: { id: 1 } },
        relations: ['parqueadero', 'tipoVehiculo'],
      });
    });

    it('Camino 2: Debería retornar arreglo vacío si el parqueadero no tiene tarifas (N1-2-3-7-F)', async () => {
      // Arrange
      tarifaRepo.find.mockResolvedValue([]);

      // Act
      const resultado = await service.findByParqueadero(99999);

      // Assert
      expect(Array.isArray(resultado)).toBe(true);
      expect(resultado.length).toBe(0);
    });

  });

  // ══════════════════════════════════════════════════════════════════════════
  // HU-29: ACTUALIZAR TARIFA
  // ══════════════════════════════════════════════════════════════════════════
  describe('HU-29: actualizar() - Actualizar Tarifa', () => {

    it('Camino 1: Debería lanzar NotFoundException si el ID no existe (N1-2-3-4-F)', async () => {
      // Arrange
      tarifaRepo.findOne.mockResolvedValue(null); // Tarifa no encontrada

      // Act
      const accion = service.actualizar(999999, { precioFraccionHora: 1000 });

      // Assert
      await expect(accion).rejects.toThrow(NotFoundException);
      await expect(accion).rejects.toThrow('No existe tarifa con id: 999999');
      expect(tarifaRepo.query).not.toHaveBeenCalled();
    });

    it('Camino 2: No debería ejecutar UPDATE si el body está vacío (N1-2-3-5-6-8-10-12-13-15-F)', async () => {
      // Arrange
      const tarifaOriginal = mockTarifa();
      tarifaRepo.findOne
        .mockResolvedValueOnce(tarifaOriginal)  // Primera llamada: verificar existencia
        .mockResolvedValueOnce(tarifaOriginal); // Segunda llamada: retornar resultado

      // Act
      const resultado = await service.actualizar(1, {});

      // Assert
      expect(tarifaRepo.query).not.toHaveBeenCalled(); // No debe ejecutar UPDATE
      expect(resultado.precioFraccionHora).toBe(tarifaOriginal.precioFraccionHora);
      expect(resultado.precioHoraAdicional).toBe(tarifaOriginal.precioHoraAdicional);
    });

    it('Camino 3: Debería actualizar solo el precio de fracción de hora (N1-2-3-5-6-7-8-10-11-12-13-15-F)', async () => {
      // Arrange
      const nuevoPrecio = 2500;
      const tarifaOriginal = mockTarifa();
      const tarifaActualizada = mockTarifa({ precioFraccionHora: nuevoPrecio });
      tarifaRepo.findOne
        .mockResolvedValueOnce(tarifaOriginal)   // verificar existencia
        .mockResolvedValueOnce(tarifaActualizada); // retornar tras UPDATE
      tarifaRepo.query.mockResolvedValue([]);

      // Act
      const resultado = await service.actualizar(1, { precioFraccionHora: nuevoPrecio });

      // Assert
      expect(tarifaRepo.query).toHaveBeenCalledTimes(1);
      expect(tarifaRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('PRECIO_FRACCION_HORA'),
        expect.arrayContaining([nuevoPrecio, 1]),
      );
      expect(resultado.precioFraccionHora).toBe(nuevoPrecio);
    });

    it('Camino 4: Debería actualizar solo el precio de hora adicional (N1-2-3-5-6-8-9-10-11-12-13-15-F)', async () => {
      // Arrange
      const nuevoPrecioAdicional = 3500;
      const tarifaOriginal = mockTarifa();
      const tarifaActualizada = mockTarifa({ precioHoraAdicional: nuevoPrecioAdicional });
      tarifaRepo.findOne
        .mockResolvedValueOnce(tarifaOriginal)
        .mockResolvedValueOnce(tarifaActualizada);
      tarifaRepo.query.mockResolvedValue([]);

      // Act
      const resultado = await service.actualizar(1, { precioHoraAdicional: nuevoPrecioAdicional });

      // Assert
      expect(tarifaRepo.query).toHaveBeenCalledTimes(1);
      expect(tarifaRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('PRECIO_HORA_ADICIONAL'),
        expect.arrayContaining([nuevoPrecioAdicional, 1]),
      );
      expect(resultado.precioHoraAdicional).toBe(nuevoPrecioAdicional);
    });

    it('Camino 5: Debería actualizar ambos precios correctamente (N1-2-3-5-6-7-8-9-10-11-12-13-15-F)', async () => {
      // Arrange
      const updateData = { precioFraccionHora: 5500, precioHoraAdicional: 2000 };
      const tarifaOriginal = mockTarifa();
      const tarifaActualizada = mockTarifa(updateData);
      tarifaRepo.findOne
        .mockResolvedValueOnce(tarifaOriginal)
        .mockResolvedValueOnce(tarifaActualizada);
      tarifaRepo.query.mockResolvedValue([]);

      // Act
      const resultado = await service.actualizar(1, updateData);

      // Assert
      expect(tarifaRepo.query).toHaveBeenCalledTimes(1);
      expect(tarifaRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('PRECIO_FRACCION_HORA'),
        expect.arrayContaining([5500, 2000, 1]),
      );
      expect(resultado.precioFraccionHora).toBe(5500);
      expect(resultado.precioHoraAdicional).toBe(2000);
    });

    it('Camino 6: Debería lanzar NotFoundException si la tarifa desaparece tras el UPDATE (N1-2-3-5-6-7-8-10-11-12-13-14-F)', async () => {
      // Arrange — simula que la tarifa existe antes del UPDATE pero desaparece después (ej. borrado concurrente)
      const tarifaOriginal = mockTarifa();
      tarifaRepo.findOne
        .mockResolvedValueOnce(tarifaOriginal) // Nodo 2: tarifa encontrada
        .mockResolvedValueOnce(null);          // Nodo 13: desapareció tras el UPDATE
      tarifaRepo.query.mockResolvedValue([]);

      // Act
      const accion = service.actualizar(1, { precioFraccionHora: 9999 });

      // Assert
      await expect(accion).rejects.toThrow(NotFoundException);
      await expect(accion).rejects.toThrow('No se pudo recuperar la tarifa actualizada con id: 1');
      expect(tarifaRepo.query).toHaveBeenCalledTimes(1); // El UPDATE sí se ejecutó
    });

  });

});