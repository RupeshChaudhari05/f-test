import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserPlan } from '../modules/users/user.entity';
import { Site } from '../modules/sites/site.entity';

// This seed script creates test users for development
// Run with: npm run seed

export async function seed() {
  // Use same database config as main app
  const dbType = process.env.DB_TYPE || 'mysql';
  console.log('🌱 Seeding database with type:', dbType);

  const dbConfig: any = {
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: false,
    logging: false,
  };

  if (dbType === 'sqlite') {
    dbConfig.type = 'sqlite';
    dbConfig.database = process.env.DB_DATABASE || 'database.sqlite';
    console.log('📁 Using SQLite database:', dbConfig.database);
  } else {
    dbConfig.type = dbType;
    dbConfig.host = process.env.DB_HOST || 'localhost';
    dbConfig.port = parseInt(process.env.DB_PORT || (dbType === 'mysql' ? '3306' : '5432'));
    dbConfig.username = process.env.DB_USERNAME || 'root';
    dbConfig.password = process.env.DB_PASSWORD || '';
    dbConfig.database = process.env.DB_NAME || 'posh_notifications';
    console.log('🗄️  Using', dbType, 'database:', dbConfig.database);
  }

  const AppDataSource = new DataSource(dbConfig);

  console.log('🔌 Connecting to database...');
  await AppDataSource.initialize();
  console.log('✅ Database connected successfully');

  const userRepo = AppDataSource.getRepository(User);

  try {
    // 1. Create Super Admin User (main)
    const superAdminEmail = 'admin@posh.local';
    let superAdmin = await userRepo.findOne({ where: { email: superAdminEmail } });

    if (!superAdmin) {
      const hashedPassword = await bcrypt.hash('Admin@123', 10);
      const userData = {
        email: superAdminEmail,
        name: 'Super Admin',
        passwordHash: hashedPassword,
        role: UserRole.SUPER_ADMIN,
        plan: UserPlan.ENTERPRISE,
        isActive: true,
      };
      superAdmin = userRepo.create(userData);
      await userRepo.save(superAdmin);
      console.log('✅ Created Super Admin:', superAdminEmail);
    } else {
      // Ensure existing user has correct super_admin role
      if (superAdmin.role !== UserRole.SUPER_ADMIN) {
        superAdmin.role = UserRole.SUPER_ADMIN;
        superAdmin.plan = UserPlan.ENTERPRISE;
        superAdmin.isActive = true;
        await userRepo.save(superAdmin);
        console.log('✅ Updated Super Admin role:', superAdminEmail);
      } else {
        console.log('ℹ️  Super Admin already exists:', superAdminEmail);
      }
    }

    // 1b. Also create admin@posh.com variant for convenience
    const superAdminEmail2 = 'admin@posh.com';
    let superAdmin2 = await userRepo.findOne({ where: { email: superAdminEmail2 } });

    if (!superAdmin2) {
      const hashedPassword = await bcrypt.hash('Admin@123', 10);
      const userData = {
        email: superAdminEmail2,
        name: 'Super Admin',
        passwordHash: hashedPassword,
        role: UserRole.SUPER_ADMIN,
        plan: UserPlan.ENTERPRISE,
        isActive: true,
      };
      superAdmin2 = userRepo.create(userData);
      await userRepo.save(superAdmin2);
      console.log('✅ Created Super Admin (alternate):', superAdminEmail2);
    } else {
      // Ensure existing user has correct super_admin role
      if (superAdmin2.role !== UserRole.SUPER_ADMIN) {
        superAdmin2.role = UserRole.SUPER_ADMIN;
        superAdmin2.plan = UserPlan.ENTERPRISE;
        superAdmin2.isActive = true;
        await userRepo.save(superAdmin2);
        console.log('✅ Updated Super Admin (alternate) role:', superAdminEmail2);
      } else {
        console.log('ℹ️  Super Admin (alternate) already exists:', superAdminEmail2);
      }
    }

    // 2. Create Client User 1
    const clientEmail1 = 'client@example.com';
    let client1 = await userRepo.findOne({ where: { email: clientEmail1 } });

    if (!client1) {
      const hashedPassword = await bcrypt.hash('Client@123', 10);
      const userData = {
        email: clientEmail1,
        name: 'John Client',
        passwordHash: hashedPassword,
        role: UserRole.ADMIN,
        plan: UserPlan.PRO,
        isActive: true,
      };
      client1 = userRepo.create(userData);
      await userRepo.save(client1);
      console.log('✅ Created Client 1:', clientEmail1);
    } else {
      console.log('ℹ️  Client 1 already exists:', clientEmail1);
    }

    // 3. Create Client User 2
    const clientEmail2 = 'jane@example.com';
    let client2 = await userRepo.findOne({ where: { email: clientEmail2 } });

    if (!client2) {
      const hashedPassword = await bcrypt.hash('Jane@123', 10);
      const userData = {
        email: clientEmail2,
        name: 'Jane Client',
        passwordHash: hashedPassword,
        role: UserRole.ADMIN,
        plan: UserPlan.STARTER,
        isActive: true,
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      };
      client2 = userRepo.create(userData);
      await userRepo.save(client2);
      console.log('✅ Created Client 2:', clientEmail2);
    } else {
      console.log('ℹ️  Client 2 already exists:', clientEmail2);
    }

    // 4. Create a Site for Client 1
    const siteRepo = AppDataSource.getRepository(Site);
    let site = await siteRepo.findOne({ where: { domain: 'example.com' } });

    if (!site && client1) {
      const siteData = {
        name: 'Example Website',
        domain: 'example.com',
        userId: client1.id,
        isActive: true,
        apiKey: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        apiSecret: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      };
      site = siteRepo.create(siteData);
      await siteRepo.save(site);
      console.log('✅ Created Site for Client 1: example.com');
    } else if (site) {
      console.log('ℹ️  Site already exists: example.com');
    }

    console.log('\n📋 Test Credentials:');
    console.log('─'.repeat(50));
    console.log('🔐 SUPER ADMIN LOGIN:');
    console.log('   URL: http://localhost:3001/super-admin/login');
    console.log('   Email: admin@posh.local OR admin@posh.com');
    console.log('   Password: Admin@123');
    console.log('');
    console.log('👤 CLIENT LOGIN 1:');
    console.log('   URL: http://localhost:3001/login');
    console.log('   Email: client@example.com');
    console.log('   Password: Client@123');
    console.log('');
    console.log('👤 CLIENT LOGIN 2:');
    console.log('   URL: http://localhost:3001/login');
    console.log('   Email: jane@example.com');
    console.log('   Password: Jane@123');
    console.log('─'.repeat(50));

  } catch (error) {
    console.error('❌ Seed failed:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

// Run seed if this is the entry point
if (require.main === module) {
  seed().catch(console.error);
}
