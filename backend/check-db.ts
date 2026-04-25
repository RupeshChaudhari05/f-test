import { DataSource } from 'typeorm';
import { Subscriber } from './src/modules/subscribers/subscriber.entity';
import { Site } from './src/modules/sites/site.entity';

async function checkSubscribers() {
  const AppDataSource = new DataSource({
    type: 'sqlite',
    database: 'database.sqlite',
    entities: [__dirname + '/src/**/*.entity{.ts,.js}'],
    synchronize: false,
    logging: false,
  });

  await AppDataSource.initialize();

  const subscriberRepo = AppDataSource.getRepository(Subscriber);
  const siteRepo = AppDataSource.getRepository(Site);

  console.log('=== SITES ===');
  const sites = await siteRepo.find();
  sites.forEach(site => {
    console.log(`ID: ${site.id}, Name: ${site.name}, Domain: ${site.domain}, API Key: ${site.apiKey?.substring(0, 10)}...`);
  });

  console.log('\n=== SUBSCRIBERS ===');
  const subscribers = await subscriberRepo.find({ relations: ['site'] });
  subscribers.forEach(sub => {
    console.log(`ID: ${sub.id}, Site: ${sub.site?.domain}, Endpoint: ${sub.endpoint?.substring(0, 50)}..., Created: ${sub.createdAt}`);
  });

  console.log(`\nTotal subscribers: ${subscribers.length}`);

  await AppDataSource.destroy();
}

checkSubscribers().catch(console.error);