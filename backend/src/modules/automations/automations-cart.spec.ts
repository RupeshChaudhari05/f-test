import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AutomationsService } from './automations.service';
import { Automation, AutomationType, DripStep, DripEnrollment } from './automation.entity';
import { Subscriber } from '../subscribers/subscriber.entity';
import { NotificationsService } from '../notifications/notifications.service';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((data: any) => data),
  remove: jest.fn(),
});

const mockNotificationsService = () => ({
  sendToSubscriberDirect: jest.fn().mockResolvedValue(undefined),
});

describe('AutomationsService – triggerCartAbandonment', () => {
  let service: AutomationsService;
  let automationRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let subscriberRepo: { findOne: jest.Mock };
  let notificationsService: { sendToSubscriberDirect: jest.Mock };

  const activeSiteId = 'site-1';
  const subscriberId = 'sub-1';

  const makeAutomation = (overrides: Partial<Automation> = {}): Automation =>
  ({
    id: 'auto-1',
    siteId: activeSiteId,
    name: 'Cart Abandonment',
    type: AutomationType.EVENT_TRIGGERED,
    isActive: true,
    triggerConfig: { event: 'cart_abandoned' },
    notificationTemplate: {
      title: 'Hey {{firstName}}, your cart is waiting!',
      message: 'You left {{product_name}} in your cart.',
      iconUrl: undefined,
      imageUrl: undefined,
      clickAction: undefined,
    },
    targetConfig: {},
    delaySeconds: 3600,
    lastTriggeredAt: null,
    totalTriggered: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    site: null as any,
    dripSteps: [],
    ...overrides,
  } as any);

  const makeSubscriber = (): Subscriber =>
  ({
    id: subscriberId,
    siteId: activeSiteId,
    customData: { firstName: 'Alice' },
    isActive: true,
    endpoint: 'https://fcm.example.com/sub1',
    p256dh: 'p256dh',
    authKey: 'authkey',
  } as any);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationsService,
        { provide: getRepositoryToken(Automation), useFactory: mockRepo },
        { provide: getRepositoryToken(DripStep), useFactory: mockRepo },
        { provide: getRepositoryToken(DripEnrollment), useFactory: mockRepo },
        { provide: getRepositoryToken(Subscriber), useFactory: mockRepo },
        { provide: NotificationsService, useFactory: mockNotificationsService },
      ],
    }).compile();

    service = module.get<AutomationsService>(AutomationsService);
    automationRepo = module.get(getRepositoryToken(Automation));
    subscriberRepo = module.get(getRepositoryToken(Subscriber));
    notificationsService = module.get(NotificationsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('does nothing when no cart_abandoned automations are configured', async () => {
    automationRepo.find.mockResolvedValue([
      makeAutomation({ triggerConfig: { event: 'other_event' } }),
    ]);

    await service.triggerCartAbandonment(activeSiteId, subscriberId, { cartId: 'c1' });

    expect(notificationsService.sendToSubscriberDirect).not.toHaveBeenCalled();
  });

  it('does nothing when subscriber is not found', async () => {
    automationRepo.find.mockResolvedValue([makeAutomation()]);
    subscriberRepo.findOne.mockResolvedValue(null);

    await service.triggerCartAbandonment(activeSiteId, subscriberId, { cartId: 'c1' });

    expect(notificationsService.sendToSubscriberDirect).not.toHaveBeenCalled();
  });

  it('sends a notification with personalization tokens replaced', async () => {
    automationRepo.find.mockResolvedValue([makeAutomation()]);
    subscriberRepo.findOne.mockResolvedValue(makeSubscriber());
    automationRepo.save.mockResolvedValue({});

    const cartData = {
      cartId: 'cart-99',
      productName: 'Wireless Headphones',
      productImage: 'https://example.com/img.jpg',
      cartUrl: 'https://shop.com/cart',
    };

    await service.triggerCartAbandonment(activeSiteId, subscriberId, cartData);

    expect(notificationsService.sendToSubscriberDirect).toHaveBeenCalledWith(
      activeSiteId,
      subscriberId,
      expect.objectContaining({
        title: 'Hey Alice, your cart is waiting!',
        message: 'You left Wireless Headphones in your cart.',
        imageUrl: 'https://example.com/img.jpg',
        clickAction: 'https://shop.com/cart',
        data: expect.objectContaining({
          cartId: 'cart-99',
          source: 'cart_abandonment',
        }),
      }),
    );
  });

  it('increments totalTriggered on the automation', async () => {
    const automation = makeAutomation();
    automationRepo.find.mockResolvedValue([automation]);
    subscriberRepo.findOne.mockResolvedValue(makeSubscriber());
    automationRepo.save.mockResolvedValue({});

    await service.triggerCartAbandonment(activeSiteId, subscriberId, { cartId: 'c1', productName: 'X' });

    expect(automationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ totalTriggered: 1, lastTriggeredAt: expect.any(Date) }),
    );
  });

  it('handles sendToSubscriberDirect errors without throwing', async () => {
    automationRepo.find.mockResolvedValue([makeAutomation()]);
    subscriberRepo.findOne.mockResolvedValue(makeSubscriber());
    automationRepo.save.mockResolvedValue({});
    notificationsService.sendToSubscriberDirect.mockRejectedValue(new Error('Push failed'));

    // Should not throw
    await expect(
      service.triggerCartAbandonment(activeSiteId, subscriberId, { cartId: 'c1' }),
    ).resolves.not.toThrow();
  });

  // ─── applyTokens (via triggerCartAbandonment) ────────────────────────────────
  it('leaves unknown tokens as-is', async () => {
    automationRepo.find.mockResolvedValue([
      makeAutomation({
        notificationTemplate: {
          title: 'Hello {{unknownField}}',
          message: 'cart total: {{cartTotal}}',
        },
      }),
    ]);
    subscriberRepo.findOne.mockResolvedValue(makeSubscriber());
    automationRepo.save.mockResolvedValue({});

    await service.triggerCartAbandonment(activeSiteId, subscriberId, { cartId: 'c1', cartTotal: 99.99 });

    expect(notificationsService.sendToSubscriberDirect).toHaveBeenCalledWith(
      activeSiteId,
      subscriberId,
      expect.objectContaining({
        title: 'Hello {{unknownField}}',
        message: 'cart total: 99.99',
      }),
    );
  });
});
