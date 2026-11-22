import { CreateRestaurantDto, ListRestaurantsDto, SearchRestaurantsDto } from '@dtos/restaurant.dto';
import RestaurantService from '@services/restaurant.service';
import { formatRestaurantDetails, formatRestaurantPage } from '@utils/formatRestaurant';
import { NextFunction, Request, Response } from 'express';

class RestaurantController {
  public restaurantService = new RestaurantService();

  public createRestaurant = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantData: CreateRestaurantDto = req.body;
      const createdRestaurant = await this.restaurantService.createRestaurant(restaurantData);
      res.status(201).json({ data: formatRestaurantDetails(createdRestaurant), message: 'Restaurant created successfully' });
    } catch (error) {
      next(error);
    }
  };

  public getRestaurantById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantDetails = await this.restaurantService.getRestaurantById(req.params.id);
      res.status(200).json({ data: formatRestaurantDetails(restaurantDetails), message: 'Restaurant fetched successfully' });
    } catch (error) {
      next(error);
    }
  };

  public listRestaurants = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = req.query as unknown as ListRestaurantsDto;
      const restaurantPage = await this.restaurantService.listRestaurants(filters);
      res.status(200).json({ data: formatRestaurantPage(restaurantPage), message: 'Restaurants fetched successfully' });
    } catch (error) {
      next(error);
    }
  };

  public searchRestaurants = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const searchFilters = req.query as unknown as SearchRestaurantsDto;
      const { interpreted, ...restaurantPage } = await this.restaurantService.searchRestaurants({ ...searchFilters });
      res.status(200).json({ data: { ...formatRestaurantPage(restaurantPage), interpreted }, message: 'Restaurants fetched successfully' });
    } catch (error) {
      next(error);
    }
  };
}

export default RestaurantController;
