import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsService } from './analytics.service';
import { Event, AnalyticsDaily, ClickEvent } from './analytics.entity';
import { Notification } from '../notifications/notification.entity';
import { Subscriber } from '../subscribers/subscriber.entity';

/** Minimal mock of a TypeORM repository */
const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  save: jest.fn(),
  create: jest.fn((data: any) => data),
  update: jest.fn(),
  upsert: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue({}),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
  }),
});

describe('AnalyticsService – Cart Abandonment', () => {
  let service: AnalyticsService;
  let eventRepo: jest.Mocked<Repository<Event>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(AnalyticsDaily), useFactory: mockRepo },
        { provide: getRepositoryToken(Event), useFactory: mockRepo },
        { provide: getRepositoryToken(ClickEvent), useFactory: mockRepo },
        { provide: getRepositoryToken(Notification), useFactory: mockRepo },
        { provide: getRepositoryToken(Subscriber), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    eventRepo = module.get(getRepositoryToken(Event));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── findAbandonedCarts ─────────────────────────────────────────────────────

  describe('findAbandonedCarts', () => {
    it('returns empty array when no cart events exist', async () => {
      eventRepo.find.mockResolvedValue([]);
      const result = await service.findAbandonedCarts('site-1', 3600);
      expect(result).toEqual([]);
    });

    it('excludes cart events that are too recent', async () => {
      const recentEvent = {
        id: 'e1',
        siteId: 'site-1',
        subscriberId: 'sub-1',
        eventType: 'cart_item_added',
        eventData: { cartId: 'cart-1', productName: 'Test' },
        createdAt: new Date(), // right now — within window
      } as any;

      eventRepo.find.mockImplementation(async ({ where }: any) => {
        if (where.eventType === 'cart_item_added') return [recentEvent];
        return [];
      });

      const result = await service.findAbandonedCarts('site-1', 3600);
      expect(result).toHaveLength(0);
    });

    it('returns an abandoned cart when conditions are met', async () => {
      const oldDate = new Date(Date.now() - 7200 * 1000); // 2 hours ago

      const cartEvent = {
        id: 'e1',
        siteId: 'site-1',
        subscriberId: 'sub-1',
        eventType: 'cart_item_added',
        eventData: { cartId: 'cart-1', productName: 'Headphones', price: 79.99 },
        createdAt: oldDate,
      } as any;

      eventRepo.find.mockImplementation(async ({ where }: any) => {
        if (where.eventType === 'cart_item_added') return [cartEvent];
        // No purchases, no notifications
        return [];
      });

      const result = await service.findAbandonedCarts('site-1', 3600);

      expect(result).toHaveLength(1);
      expect(result[0].subscriberId).toBe('sub-1');
      expect(result[0].cartId).toBe('cart-1');
      expect(result[0].cartData.productName).toBe('Headphones');
    });

    it('excludes cart when subscriber has a recent purchase', async () => {
      const oldDate = new Date(Date.now() - 7200 * 1000);
      const recentDate = new Date(Date.now() - 1800 * 1000); // 30 min ago

      const cartEvent = {
        id: 'e1',
        siteId: 'site-1',
        subscriberId: 'sub-1',
        eventType: 'cart_item_added',
        eventData: { cartId: 'cart-1' },
        createdAt: oldDate,
      } as any;

      const purchaseEvent = {
        id: 'e2',
        siteId: 'site-1',
        subscriberId: 'sub-1',
        eventType: 'purchase_completed',
        eventData: { orderId: 'ord-1' },
        createdAt: recentDate,
      } as any;

      eventRepo.find.mockImplementation(async ({ where }: any) => {
        if (where.eventType === 'cart_item_added') return [cartEvent];
        if (where.eventType === 'purchase_completed') return [purchaseEvent];
        return [];
      });

      const result = await service.findAbandonedCarts('site-1', 3600);
      expect(result).toHaveLength(0);
    });

    it('excludes cart when already notified', async () => {
      const oldDate = new Date(Date.now() - 7200 * 1000);

      const cartEvent = {
        id: 'e1',
        siteId: 'site-1',
        subscriberId: 'sub-1',
        eventType: 'cart_item_added',
        eventData: { cartId: 'cart-1' },
        createdAt: oldDate,
      } as any;

      const notifiedEvent = {
        id: 'e3',
        siteId: 'site-1',
        subscriberId: 'sub-1',
        eventType: 'cart_abandonment_notified',
        eventData: { cartId: 'cart-1' },
        createdAt: new Date(Date.now() - 600 * 1000),
      } as any;

      eventRepo.find.mockImplementation(async ({ where }: any) => {
        if (where.eventType === 'cart_item_added') return [cartEvent];
        if (where.eventType === 'cart_abandonment_notified') return [notifiedEvent];
        return [];
      });

      const result = await service.findAbandonedCarts('site-1', 3600);
      expect(result).toHaveLength(0);
    });

    it('deduplicates multiple events for the same cartId', async () => {
      const oldDate = new Date(Date.now() - 7200 * 1000);

      const makeEvent = (id: string, offset: number) => ({
        id,
        siteId: 'site-1',
        subscriberId: 'sub-1',
        eventType: 'cart_item_added',
        eventData: { cartId: 'cart-1', productName: `Item ${id}` },
        createdAt: new Date(oldDate.getTime() - offset * 1000),
      } as any);

      eventRepo.find.mockImplementation(async ({ where }: any) => {
        if (where.eventType === 'cart_item_added') return [makeEvent('e1', 0), makeEvent('e2', 30)];
        return [];
      });

      const result = await service.findAbandonedCarts('site-1', 3600);
      // Should be deduplicated to a single cart
      expect(result).toHaveLength(1);
    });
  });

  // ─── markCartAbandoned ──────────────────────────────────────────────────────

  describe('markCartAbandoned', () => {
    it('saves a cart_abandonment_notified event', async () => {
      const saved = { id: 'ev-saved' };
      eventRepo.save.mockResolvedValue(saved as any);

      await service.markCartAbandoned('site-1', 'sub-1', 'cart-1');

      expect(eventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: 'site-1',
          subscriberId: 'sub-1',
          eventType: 'cart_abandonment_notified',
          eventData: expect.objectContaining({ cartId: 'cart-1' }),
        }),
      );
      expect(eventRepo.save).toHaveBeenCalled();
    });
  });
});
