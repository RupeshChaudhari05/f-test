import { DataSource } from 'typeorm';
import { User, UserRole } from './modules/users/user.entity';

async function updateRoles() {
  const AppDataSource = new DataSource({
    type: process.env.DB_TYPE as any || 'sqlite',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'database.sqlite',
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    synchronize: false,
    logging: false,
  });

  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);

  // Update all users with role 'admin' to 'client'
  await userRepo.update({ role: 'admin' as any }, { role: UserRole.ADMIN });

  console.log('Updated admin roles to client');

  await AppDataSource.destroy();
}

updateRoles().catch(console.error);