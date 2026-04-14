import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmpresasModule } from './empresas/empresas.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ParqueaderosModule } from './parqueaderos/parqueaderos.module';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './auth/auth.module';
import { CeldasModule } from './celdas/celdas.module';
import { VehiculosModule } from './vehiculos/vehiculos.module';
import { ReservasModule } from './reservas/reservas.module';
import { TarifasModule } from './tarifas/tarifas.module';
import { PagosModule } from './pagos/pagos.module';
import { FacturacionModule } from './facturacion/facturacion.module';
import { ReportesModule } from './reportes/reportes.module';
import { VistasModule } from './vistas/vistas.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Detectamos el tipo de base de datos desde el entorno
        const dbType = configService.get<string>('DB_TYPE') || 'oracle';
        const isSqlite = dbType === 'sqlite';

        return {
          type: dbType as any,
          // Configuración condicional según el motor
          host: isSqlite ? undefined : configService.get<string>('DB_HOST'),
          port: isSqlite ? undefined : Number(configService.get<number>('DB_PORT')),
          username: isSqlite ? undefined : configService.get<string>('DB_USERNAME'),
          password: isSqlite ? undefined : configService.get<string>('DB_PASSWORD'),
          sid: isSqlite ? undefined : configService.get<string>('DB_SID'),
          
          // SQLite en memoria para tests, de lo contrario no se usa database string en Oracle
          database: isSqlite ? ':memory:' : undefined,
          
          // Sincronización automática solo para SQLite (evita borrar datos en Oracle)
          synchronize: isSqlite, 
          dropSchema: false,
          autoLoadEntities: true,
          logging: configService.get<string>('NODE_ENV') !== 'production',
          
          // El pool de conexiones solo aplica a Oracle
          extra: isSqlite ? {} : {
            poolMin: 1,
            poolMax: 10,
            poolIncrement: 1,
          },
        };
      },
    }),
    SharedModule,
    AuthModule,
    EmpresasModule,
    UsuariosModule,
    ParqueaderosModule,
    CeldasModule,
    VehiculosModule,
    TarifasModule,
    ReservasModule,
    PagosModule,
    FacturacionModule,
    ReportesModule,
    VistasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}