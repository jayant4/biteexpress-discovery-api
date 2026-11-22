import RestaurantController from '@controllers/restaurant.controller';
import { CreateRestaurantDto, ListRestaurantsDto, SearchRestaurantsDto } from '@dtos/restaurant.dto';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import { Router } from 'express';

class RestaurantRoute implements Routes {
  public path = '/v1/restaurants';
  public router = Router();
  public restaurantController = new RestaurantController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}`, validationMiddleware(CreateRestaurantDto, 'body'), this.restaurantController.createRestaurant);
    this.router.get(`${this.path}`, validationMiddleware(ListRestaurantsDto, 'query'), this.restaurantController.listRestaurants);
    this.router.get(`${this.path}/search`, validationMiddleware(SearchRestaurantsDto, 'query'), this.restaurantController.searchRestaurants);
    this.router.get(`${this.path}/:id`, this.restaurantController.getRestaurantById);
  }
}

export default RestaurantRoute;
